import App from "@/lib/app/app";
import { SendableData, TransferableData } from "@/lib/communicator/base";
import { ConnectionState, LongCommunicator, LongCommunicatorOptions, LongRequestOptions, LongResponse } from "@/lib/communicator/long";
import { PbSignalling } from "@/lib/model/et/et.go";
import { TimeId } from "../utils/mixed";
import { FlexPacker } from "./flex";

interface WebRTCCommunicatorOptions extends LongCommunicatorOptions {
    iceServers: RTCIceServer[],
    onopen?: (ev: Event) => void,
    onclose?: (ev: Event) => void,
}

export class WebRTCCommunicator extends LongCommunicator {
    private peer!: RTCPeerConnection;
    private channel!: RTCDataChannel;

    constructor(pp: string, protected options: WebRTCCommunicatorOptions) {
        super(pp, options);
    }

    public chan(): RTCDataChannel {
        return this.channel;
    }

    private createPeer(): RTCPeerConnection {
        return new RTCPeerConnection({ iceServers: this.options.iceServers });
    }

    private handleChannel(channel: RTCDataChannel) {
        this.channel = channel;
        this.channel.onmessage = e => this.onmessage(e.data);
        this.channel.onopen = e => this.onopen(this.options.onopen?.bind(null, e));
        this.channel.onclose = e => this.onclose(this.options.onclose?.bind(null, e));
    }

    public async createOffer(): Promise<RTCSessionDescriptionInit> {
        this.peer = this.createPeer();
        this.handleChannel(this.peer.createDataChannel('msg'));
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        return offer;
    }

    public async acceptOffer(offer: RTCSessionDescriptionInit, iceCandidate: (candidate: RTCIceCandidate) => void): Promise<RTCSessionDescriptionInit> {
        this.peer = this.createPeer();
        this.peer.onicecandidate = e => e.candidate && iceCandidate(e.candidate);
        this.peer.ondatachannel = e => e.channel && this.handleChannel(e.channel);
        await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        return answer;
    }

    public answer(answer: RTCSessionDescriptionInit) {
        this.peer.setRemoteDescription(new RTCSessionDescription(answer));
    }

    public iceCandidate(iceCandidate: RTCIceCandidateInit) {
        this.peer.addIceCandidate(iceCandidate);
    }

    private internetProtocol!: string;
    public set ip(value: string) {
        this.internetProtocol = value;
    }
    public get ip(): string {
        return this.internetProtocol || "Unknown";
    }

    public get pp(): string {
        return this.address;
    }

    protected sendRaw(content: TransferableData): void {
        if (this.channel?.readyState !== 'open') {
            this.channel && this.setState({
                'closed': ConnectionState.Disconnected,
                'closing': ConnectionState.Disconnected,
                'connecting': ConnectionState.Connecting,
            }[this.channel.readyState]);
            return;
        }
        // @ts-ignore
        this.channel.send(content);
    }

    protected promiseChannel(): string {
        return `wrtc-${this.address}`;
    }

    protected timeoutTip(resumed?: boolean): string {
        !resumed && console.warn("Request timeout");
        return "Request timeout: No rtc response was received within {{timeout}} seconds after the request was sent";
    }

    protected opening(): void {
        throw new Error("`opening` was unreachable.");
    }

    protected closing(): void {
        this.channel.close();
        this.peer.close();
    }

    public async ping(): Promise<number> {
        const timer = ((ts: number) => new Date().getTime() - ts).bind(null, new Date().getTime());
        return this.request("ping").then(_ => timer());
    }
}

export class WebRTCRouter {
    private connectionMapping: { [index: string]: WebRTCCommunicator } = {};
    private listenMapping: { [index: string]: (resp: LongResponse, communicator: LongCommunicator) => void } = {};

    private constructor(
        private tid: string, 
        private sc: LongCommunicator,
        private webrtcOptions: WebRTCCommunicatorOptions,
    ) {
        this.signalling();
    }

    private signalling(): void {
        this.sc.listen(`et/${this.tid}/req`, this.createOffer.bind(this))
            .listen(`et/${this.tid}/offer`, this.acceptOffer.bind(this))
            .listen(`et/${this.tid}/answer`, this.answer.bind(this))
            .listen(`et/${this.tid}/ice`, this.iceCandidate.bind(this))
            .send(`et/${this.tid}/req`, this.requestOffer());
    }

    private unsignalling(): void {
        this.sc.unlisten(`et/${this.tid}/req`, `et/${this.tid}/offer`, `et/${this.tid}/answer`, `et/${this.tid}/ice`);
    }

    public listen(path: string, callback: (resp: LongResponse, communicator: LongCommunicator) => void): void {
        this.listenMapping[path] = callback;
    }

    public unlisten(...paths: string[]): void {
        paths.forEach(path => delete this.listenMapping[path]);
        this.filter().forEach(conn => conn.unlisten(...paths));
    }

    public async send(pp: string, path: string, options?: LongRequestOptions | SendableData, id?: number): Promise<number> {
        const conn = this.connectionMapping[pp];
        if (conn?.state !== ConnectionState.Connected) throw new Error(`Connection of PP "${pp}" does not exist.`);
        return conn.send(path, options, id);
    }

    public async request(pp: string, path: string, options?: LongRequestOptions | SendableData): Promise<LongResponse> {
        const conn = this.connectionMapping[pp];
        if (conn?.state !== ConnectionState.Connected) throw new Error(`Connection of PP "${pp}" does not exist.`);
        return conn.request(path, options);
    }

    public broadcast(path: string, options?: LongRequestOptions | SendableData) {
        this.filter(conn => conn.state === ConnectionState.Connected).forEach(conn => conn.send(path, options));
    }

    public free() {
        this.unsignalling();
        this.filter(conn => conn.state === ConnectionState.Connected).forEach(conn => conn.free());
        this.connectionMapping = {};
    }

    public connBy(pp: string): WebRTCCommunicator|undefined {
        return this.connectionMapping[pp];
    }

    public filter(filter?: (wrtc: WebRTCCommunicator) => boolean): WebRTCCommunicator[] {
        ! filter && (filter = () => true);
        return Object.values(this.connectionMapping).filter(filter);
    }

    private setConnectionMapping(sig: PbSignalling, conn: WebRTCCommunicator, initiative?: boolean): void {
        this.internetProtocol = sig.sender || "Unknown";
        conn.ip = sig.receiver || "Unknown";
        this.connectionMapping[initiative ? sig.requester : (sig.responder || "")] = conn;
        Object.entries(this.listenMapping).forEach(([k, v]) => conn.listen(k, v));
    }

    private requestOffer(): Uint8Array {
        return PbSignalling.toBinary(PbSignalling.create({
            requester: this.pp,
            sig: {
                oneofKind: "req",
                req: 1,
            },
        }));
    }

    private async createOffer(resp: LongResponse) {
        const sig = await this.parseResp(resp);
        const wrtc = new WebRTCCommunicator(sig.requester, this.webrtcOptions);
        sig.sig = {
            oneofKind: "offer",
            offer: JSON.stringify(await wrtc.createOffer())
        };
        sig.responder = this.pp;
        [sig.sender, sig.receiver] = [sig.receiver, sig.sender];
        this.sc.send(`et/${this.tid}/offer`, PbSignalling.toBinary(sig));
        this.setConnectionMapping(sig, wrtc, true);
    }

    private async acceptOffer(resp: LongResponse) {
        const sig = await this.parseResp(resp);
        if (sig.requester !== this.pp || !sig.responder || sig.sig.oneofKind !== "offer") return;
        [sig.sender, sig.receiver] = [sig.receiver, sig.sender];
        const wrtc = new WebRTCCommunicator(sig.responder, this.webrtcOptions);
        const answer = await wrtc.acceptOffer(JSON.parse(sig.sig.offer), candidate => {
            const sigCandidate = Object.assign({}, sig, {
                sig: {
                    oneofKind: "iceCandidate",
                    iceCandidate: JSON.stringify(candidate),
                }
            });
            this.sc.send(`et/${this.tid}/ice`, PbSignalling.toBinary(sigCandidate));
        })
        const sigAnswer = Object.assign({}, sig, {
            sig: {
                oneofKind: "answer",
                answer: JSON.stringify(answer),
            }
        });
        this.sc.send(`et/${this.tid}/answer`, PbSignalling.toBinary(sigAnswer));
        this.setConnectionMapping(sig, wrtc);
    }

    private async answer(resp: LongResponse) {
        const sig = await this.parseResp(resp);
        const wrtc = this.connectionMapping[sig.requester];
        if (! wrtc || sig.sig.oneofKind !== "answer") return;
        wrtc.answer(JSON.parse(sig.sig.answer));
    }

    private async iceCandidate(resp: LongResponse) {
        const sig = await this.parseResp(resp);
        const wrtc = this.connectionMapping[sig.requester];
        if (!wrtc || sig.sig.oneofKind !== "iceCandidate") return;
        wrtc.iceCandidate(JSON.parse(sig.sig.iceCandidate));
    }

    private async parseResp(resp: LongResponse): Promise<PbSignalling> {
        return resp.arrayBuffer().then(ab => PbSignalling.fromBinary(new Uint8Array(ab)));
    }

    private internetProtocol!: string;
    public get ip(): string {
        return this.internetProtocol || "Unknown"
    }

    private peerProtocol!: string;
    public get pp(): string {
        if (! this.peerProtocol) {
            this.peerProtocol = TimeId.get;
        }
        return this.peerProtocol;
    }

    public static isSupported(): boolean {
        return typeof RTCPeerConnection !== 'undefined';
    }

    private static instance: WebRTCRouter;
    public static inst(tid: string, webrtcOptions?: WebRTCCommunicatorOptions | {}): WebRTCRouter {
        if (! this.instance) {
            this.instance = new WebRTCRouter(tid, App.cw, Object.assign({
                packer: new FlexPacker(),
                iceServers: JSON.parse(process.env.NEXT_PUBLIC_CONFIG || "{}").iceServers,
                // keepAlivePeriod: 60000,
            }, webrtcOptions || {}));
        } else if (tid !== this.instance.tid) {
            this.instance.free();
            this.instance.tid = tid;
            this.instance.signalling();
        }
        return this.instance;
    }
}

