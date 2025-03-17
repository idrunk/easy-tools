export type TransferableData = string | ArrayBufferLike | Blob | ArrayBufferView
export type SendableData = TransferableData | File | URLSearchParams | FormData | ReadableStream

export interface RequestOptions {
    body?: SendableData,
}

export interface Response {
    arrayBuffer(): Promise<ArrayBuffer>,
    blob(): Promise<Blob>,
    text(): Promise<string>,
    json(): Promise<object>,
}

export class RespError extends Error {
    constructor(message: string, public resp: Response) {
        super(message);
    }
}

type ReqOptHandler = (options: RequestOptions) => Promise<void>;
type RespHandler = (resp: Response) => Promise<void>;

export interface CommunicatorOptions {
    reqOptHandler?: ReqOptHandler,
    respHandler?: RespHandler,
}

export interface Communicator {
    readonly address: string,
    request(path: string, options?: RequestOptions | SendableData): Promise<Response>
}
