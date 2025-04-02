import log from "../utils/log";
import TimePromise from "../utils/promise";
import { Communicator, CommunicatorOptions, RequestOptions, RespError, Response, SendableData, TransferableData } from "./base";

export enum ConnectionState {
    Unconnected,
    Connecting,
    Connected,
    Disconnected,
}

export abstract class Packer {
    public abstract newPkg(path: string, body: Uint8Array | string, sid: string, id: number, numPath: number): Package;
    public abstract serialize(pkg: Package): Uint8Array;
    public abstract deserialize(seq: any): Package;
}

export abstract class Package {
    public id!: number;
    public path!: string;
    public numPath!: number;
    public sid!: string;
    public code!: number;
    public message!: string;
    public body!: Uint8Array|string;

    private static reqId = 0;

    protected with(path: string, body: Uint8Array|string, sid: string, id: number, numPath: number): this {
        if (id === -1) {
            id = id >= Number.MAX_SAFE_INTEGER ? 1 : ++Package.reqId;
        }
        this.id = id;
        this.path = path;
        this.sid = sid;
        this.numPath = numPath;
        this.body = body;
        return this;
    }

    public text(): string {
        return this.body instanceof Uint8Array ? new TextDecoder().decode(this.body) : this.body;
    }

    public abstract serialize(): Uint8Array
}

export class LongResponse implements Response {
    constructor(public pkg: Package) {}

    public async body(): Promise<TransferableData> {
        return this.pkg.body;
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        return this.body().then(body => {
            if (body === undefined) {
                return body;
            } else if (ArrayBuffer.isView(body)) {
                return body.buffer as ArrayBuffer;
            }
            throw new Error("Response body is not an ArrayBuffer.");
        })
    }

    public async blob(): Promise<Blob> {
        return this.body().then(body => {
            if (body === undefined || body instanceof Blob) return body;
            throw new Error("Response body is not a Blob.");
        })
    }

    public async text(): Promise<string> {
        return this.body().then(body => {
            if (body === undefined || typeof body === "string") return body;
            throw new Error("Response body is not a string."); // TODO, support other convert to string
        })
    }

    public async json(): Promise<object> {
        return this.text().then(text => JSON.parse(text));
    }
}

export interface LongCommunicatorOptions extends CommunicatorOptions {
    packer: Packer,
    uncovered?: (data: Package | any, parsed?: boolean) => void,
    stateChange?: (state: ConnectionState, before: ConnectionState, conn: LongCommunicator) => void,
    autoReconnect?: boolean,
    keepAlivePeriod?: number,
}

export interface LongRequestOptions extends RequestOptions {
    sid?: string,
    timeout: number, // 超时时长（微秒）
}

export abstract class LongCommunicator implements Communicator {
    protected stateCode: ConnectionState = ConnectionState.Unconnected;
    private lastMessage: number = 0;
    private listenMapping: { [index: string]: (resp: LongResponse, communicator: LongCommunicator) => void } = {};
    private reconnecting: boolean = false;
    private reconnectWaitingQueue: [(value: any) => void, (error: string) => void][] = [];

    constructor(
        public readonly address: string,
        protected options: LongCommunicatorOptions,
    ) { }

    public open(): void {
        this.setState(ConnectionState.Connecting);
        this.opening();
    }

    protected setState(state: ConnectionState): void {
        const before = this.stateCode;
        this.stateCode = state;
        this.options.stateChange && (this.options.stateChange(state, before, this));
    }

    protected onopen(handler?: () => void): void {
        this.setState(ConnectionState.Connected);
        this.keepAlive();
        handler && handler();
        TimePromise.get(this.promiseChannel(), "open-a-connection")?.resolve(true);
    }

    protected onclose(handler?: () => void): void {
        this.setState(ConnectionState.Disconnected);
        handler && handler();
    }

    protected async online(): Promise<boolean> {
        if (this.stateCode === ConnectionState.Connected) {
            return true;
        } else if (! this.options.autoReconnect) {
            return false;
        }
        return new Promise((resolve, reject) => {
            this.reconnectWaitingQueue.push([resolve, reject]);
            if (this.reconnecting) return;
            this.reconnecting = true;
            const connectWaitingTime = 10000;
            const maxCounting = 3;
            let counter = 0;
            const reconnect = () => {
                console.warn("Connection lost, trying to reconnect.");
                // 状态不在连接中时才调用`open`
                this.stateCode !== ConnectionState.Connecting && this.open();
                const connectTime = new Date().getTime();
                let state = false;
                TimePromise.register<boolean>(this.promiseChannel(), "open-a-connection", connectWaitingTime, "Failed to reconnect")
                    .then(result => state = result).catch(() => { }).finally(() => {
                        if (state) {
                            this.reconnectWaitingQueue.forEach(([res]) => res(true));
                        } else {
                            this.setState(ConnectionState.Unconnected);
                            if (++counter >= maxCounting) {
                                this.reconnectWaitingQueue.forEach(([_, rej]) => rej("Request failed, connection was lost."));
                                console.warn("Reconnection failed, please contact the administrator to check the server.");
                            } else {
                                const timeToNextTry = connectWaitingTime + connectTime - new Date().getTime();
                                return setTimeout(reconnect, timeToNextTry < 0 ? 0 : timeToNextTry);
                            }
                        }
                        this.reconnecting = false;
                        this.reconnectWaitingQueue = [];
                    })
            }
            reconnect();
        })
    }

    private keepAlive(): void {
        if (
            !this.options.keepAlivePeriod
            || this.stateCode !== ConnectionState.Connected
        ) return;
        const period = this.lastMessage > 0 ? this.options.keepAlivePeriod + this.lastMessage - new Date().getTime() : this.options.keepAlivePeriod;
        setTimeout(() => {
            // 如果等待期间发过数据，则延到下轮再ping
            if (new Date().getTime() - this.lastMessage < (this.options.keepAlivePeriod || 0))
                return this.keepAlive();
            log.debug(`${this.constructor.name} ping sent`);
            this.ping().then(_ => this.keepAlive()).catch(_ => this.setState(ConnectionState.Disconnected));
        }, period < 0 ? 0 : period);
    }

    protected onmessage(data: any): void {
        this.lastMessage = new Date().getTime();
        let p: Package;
        try {
            p = this.options.packer.deserialize(data);
        } catch (e) {
            this.options?.uncovered ? this.options.uncovered(data) : console.error(e);
            return
        }
        const resp = new LongResponse(p);
        this.options?.respHandler && this.options.respHandler(resp);
        if (p.code || p.message) {
            console.warn(`Code: ${p.code}, Message: ${p.message}`);
        }
        const promise = TimePromise.get(this.promiseChannel(), String(p.id));
        if (promise) {
            promise.resolve(resp);
        } else if (p.path in this.listenMapping) {
            this.listenMapping[p.path](resp, this);
        } else if (this.options.uncovered) {
            this.options.uncovered(resp, true);
        }
    }

    public listen(path: string, callback: (resp: LongResponse, communicator: LongCommunicator) => void): this {
        this.listenMapping[path] = callback;
        return this;
    }

    public unlisten(...paths: string[]): void {
        paths.forEach(path => delete this.listenMapping[path]);
    }

    public async sendData(content: TransferableData): Promise<void> {
        this.lastMessage = new Date().getTime();
        return this.online()
            .then(() => this.sendRaw(content))
            .catch(e => {
                console.warn(String(e));
                throw e;
            })
    }

    public async send(path: string, options?: LongRequestOptions | SendableData, id?: number): Promise<number> {
        if (!options) {
            options = { timeout: 0 };
        } else if (typeof options == "string" || !Reflect.has(options, "body")) {
            options = { timeout: 0, body: options as SendableData };
        }
        options = options as LongRequestOptions;
        // TODO, 协议层直接支持File等对象转换为TransferableData
        const body = options?.body || "";
        this.options?.reqOptHandler && this.options.reqOptHandler(options);
        const pkg = this.options.packer.newPkg(path, body as Uint8Array | string, options.sid || "", id ?? 0, 0);
        return this.sendData(pkg.serialize()).then(() => pkg.id);
    }

    public async request(path: string, options?: LongRequestOptions | SendableData): Promise<LongResponse> {
        return this.send(path, options, -1)
            .then(reqId => TimePromise.register<LongResponse>(this.promiseChannel(), String(reqId), (options as any)?.timeout || 0, this.timeoutTip)
                .then(resp => resp.pkg.code > 0 ? Promise.reject(new RespError(resp.pkg.message, resp)) : Promise.resolve(resp)));
    }

    public close(code?: number, reason?: string): void {
        this.closing(code, reason);
    }

    public free(code?: number, reason?: string): void {
        this.close(code, reason);
        this.listenMapping = {};
        this.reconnectWaitingQueue = [];
    }

    public get state(): number {
        return this.stateCode;
    }

    protected abstract sendRaw(content: TransferableData): void;
    protected abstract promiseChannel(): string;
    protected abstract timeoutTip(resumed?: boolean): string;
    protected abstract opening(): void;
    protected abstract closing(code?: number, reason?: string): void;
    public abstract ping(): Promise<number>;
}
