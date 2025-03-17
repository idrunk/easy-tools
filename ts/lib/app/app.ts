import { HttpCommunicator } from "../communicator/comm-h";
import { FlexWSC, WebsocketCommunicator } from "../communicator/comm-ws";

export default class App {
    private static wsComm: WebsocketCommunicator;
    public static get cw(): WebsocketCommunicator {
        if (! this.wsComm)
            this.wsComm = FlexWSC(process.env?.NEXT_PUBLIC_WEBSOCKET_ADDRESS ?? "");
        return this.wsComm;
    }

    private static hComm: HttpCommunicator
    public static get ch(): HttpCommunicator {
        if (! this.hComm)
            this.hComm = new HttpCommunicator(process.env?.NEXT_BACKEND_HTTP_ADDRESS ?? process.env?.NEXT_PUBLIC_HTTP_ADDRESS ?? "", {});
        return this.hComm;
    }
}