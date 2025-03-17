import { Middleware } from "@/middleware";
import { NextRequest, NextResponse } from "next/server";
import { parseSetCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { HttpRequestOptions } from "@/lib/communicator/comm-h";
import { PbTopic } from "@/lib/model/et/et.go";
import App from "@/lib/app/app";

export class EtMiddleware implements Middleware {
    public matcher(): string {
        return '/et/(.+)';
    }

    public match(path: string): boolean {
        return new RegExp(this.matcher()).test(path);
    }

    public async handle(req: NextRequest): Promise<NextResponse> {
        const options = { headers: {} } as HttpRequestOptions;
        // @ts-ignore
        req.cookies && (options.headers.cookie = req.cookies);

        const matches = req.nextUrl.pathname.match(/^(?:.*\/et\/)?([\w-]{3,})/);
        let tid = matches?.[1];
        if (tid === "new") {
            tid = await App.ch.get("api/et/tid").then(resp => resp.text());
            return NextResponse.redirect(`${req.nextUrl.origin}/et/${tid}`);
        }
        let topic: PbTopic | undefined;
        let status: number = 0;
        let setCookie: string[] = [];
        await App.ch.get(`api/et/${tid}/auth`, options).then(async resp => {
            setCookie = resp.headers.getSetCookie();
            return resp.text().then(txt => PbTopic.fromJsonString(txt));
        })
            .then(t => topic = t)
            .catch(e => status = e.resp?.status || 0);

        const headers = new Headers(req.headers);
        headers.set("topic-id", topic?.id || "");
        headers.set("topic-key", topic?.key || "");
        headers.set("auth-status", String(status));
        const response = NextResponse.next({ request: { headers } });
        if (setCookie?.length) {
            setCookie.forEach(cookie => {
                const parsedCookie = parseSetCookie(cookie)
                parsedCookie && response.cookies.set(parsedCookie)
            });
        }
        return response;
    }

}