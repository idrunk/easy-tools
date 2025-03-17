import { NextRequest, NextResponse } from "next/server";
import { EtMiddleware } from "./app/et/middleware";

export interface Middleware {
    matcher(): string
    match(path: string): boolean
    handle(request: NextRequest): Promise<NextResponse>
}

class MiddlewareRouter {
    private readonly map: { [index: string]: Middleware } = {}

    public push(middleware: Middleware): this {
        this.map[middleware.matcher()] = middleware
        return this
    }

    public async route(request: NextRequest): Promise<NextResponse|undefined> {
        for (const middleware of Object.values(this.map)) {
            if (middleware.match(request.nextUrl.pathname))
                return await middleware.handle(request)
        }
    }

    public getConfig(): { matcher: string[] } {
        return { matcher: Object.keys(this.map) }
    }
}

const mr = new MiddlewareRouter()
    .push(new EtMiddleware())

// export const config = mr.getConfig()

export async function middleware(request: NextRequest) {
    return await mr.route(request)
}
