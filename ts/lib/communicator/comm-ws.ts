import { Communicator, TransferableData } from "./base"
import { FlexPacker } from "./flex"
import { LongCommunicatorOptions, LongCommunicator } from "./long"

interface WebsocketOptions extends LongCommunicatorOptions {
    onopen: (ev: Event) => void,
    onclose: (ev: CloseEvent) => void,
}

export class WebsocketCommunicator extends LongCommunicator implements Communicator {
    private ws!: WebSocket;

    constructor(address: string, protected options: WebsocketOptions) {
        super(address, options);
        this.open();
    } 

    protected opening(): void {
        this.ws = new WebSocket(this.address);
        this.ws.binaryType = "arraybuffer";
        this.ws.onopen = ev => this.onopen(this.options.onopen?.bind(null, ev));
        this.ws.onclose = ev => this.onclose(this.options.onclose?.bind(null, ev));
        this.ws.onmessage = ev => this.onmessage(ev.data);
    }

    protected closing(code?: number, reason?: string): void {
        this.ws.close(code, reason);
    }

    protected sendRaw(content: TransferableData): void {
        this.ws.send(content);
    }

    public async ping(): Promise<number> {
        const timer = ((ts: number) => new Date().getTime() - ts).bind(null, new Date().getTime());
        return this.request("ping").then(_=>timer());
    }

    protected promiseChannel(): string {
        return "websocket-channel";
    }

    protected timeoutTip(resumed?: boolean): string {
        !resumed && console.warn("Request timeout");
        return "Request timeout: No response was received within {{timeout}} seconds after the request was sent";
    }
}

export const FlexWSC = (address: string, options?: WebsocketOptions) => {
    !options && (options = {} as WebsocketOptions);
    !options.packer && (options.packer = new FlexPacker);
    options.autoReconnect === undefined && (options.autoReconnect = true);
    options.keepAlivePeriod === undefined && (options.keepAlivePeriod = 60000);
    return new WebsocketCommunicator(address, options);
}