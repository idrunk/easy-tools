import { Communicator, CommunicatorOptions, RequestOptions, Response as IfResponse, RespError } from "./base"

export enum Method {
    Get = "GET",
    Post = "POST",
    Put = "PUT",
    Delete = "DELETE",
    Head = "HEAD",
    Options = "OPTIONS",
    Connect = "CONNECT",
    Patch = "PATCH",
    Trace = "TRACE",
}

export interface HttpCommunicatorOptions extends CommunicatorOptions {}

// @ts-ignore
export interface HttpRequestOptions extends RequestOptions, RequestInit {}

export class HttpResponse extends Response implements IfResponse {
    public static from(resp: Response): HttpResponse {
        return resp as HttpResponse
    }
}

export class HttpCommunicator implements Communicator {
    constructor(
        public readonly address: string,
        private options: HttpCommunicatorOptions,
    ) { }

    private makeUrl(path: string): string {
        if (/https?:\/\//.test(path)) {
            return path;
        } else if (path.startsWith('/')) {
            throw new Error("Only supports absolute path, do not start with `/`");
        }
        return this.address + '/' + path;
    }

    public async request(path: string, options?: HttpRequestOptions): Promise<HttpResponse> {
        !options && (options = {});
        options.credentials = 'include';
        this.options.reqOptHandler && await this.options.reqOptHandler(options);
        return fetch(this.makeUrl(path), options as RequestInit).then(async response => {
            const resp = HttpResponse.from(response);
            this.options.respHandler && await this.options.respHandler(resp);
            return new Promise((resolve, reject) => 
                resp.status >= 400 && resp.status < 600 ? reject(new RespError(resp.statusText, resp)) : resolve(resp));
        })
    }

    public async get(path: string, options?: HttpRequestOptions): Promise<HttpResponse> {
        options && (options.method = Method.Get);
        return this.request(path, options);
    }

    public async post(path: string, body?: BodyInit, options?: HttpRequestOptions): Promise<HttpResponse> {
        !options && (options = {});
        options.method = Method.Post;
        options.body = body;
        return this.request(path, options);
    }

    public async put(path: string, body?: BodyInit, options?: HttpRequestOptions): Promise<HttpResponse> {
        !options && (options = {});
        options.method = Method.Put;
        options.body = body;
        return this.request(path, options);
    }

    public async patch(path: string, body?: BodyInit, options?: HttpRequestOptions): Promise<HttpResponse> {
        !options && (options = {});
        options.method = Method.Patch;
        options.body = body;
        return this.request(path, options);
    }

    public async delete(path: string, options?: HttpRequestOptions): Promise<HttpResponse> {
        !options && (options = {});
        options.method = Method.Delete;
        return this.request(path, options);
    }
}
