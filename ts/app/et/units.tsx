import { formatBytes } from "@/lib/utils/mixed";
import React from "react";
import { Chat, MessageView } from "./lib";
import { PbChat_DownloadState } from "@/lib/model/et/et";
import dayjs from "dayjs";
import Image from "next/image";
import { Html5Qrcode } from "html5-qrcode";

export function MessageSummary({msg}: {msg: MessageView}): React.ReactNode {
    if (msg.body.oneofKind === 'text') {
        return msg.body.text;
    } else if (msg.body.oneofKind === 'file') {
        const prefix = msg.body.file.download ? '下载了文件' : '发送了文件';
        return `${prefix} (${msg.body.file.name}) [${formatBytes(Number(msg.body.file.size))}]`;
    } else if (msg.body.oneofKind === 'img') {
        const prefix = msg.mine ? '发送了图片' : '收到了图片';
        return `${prefix} (${msg.body.img.file?.name})`;
    }
}

export function MessageTime({msg}: {msg: MessageView}): React.ReactNode {
    return dayjs(msg.sendTime).format("MM-DD HH:mm:ss");
}

function FileState({state} : {state?: PbChat_DownloadState}): React.ReactNode {
    return {
        [PbChat_DownloadState.NotDownloadable]: "✖",
        [PbChat_DownloadState.Downloadable]: "⬇",
        [PbChat_DownloadState.Downloading]: "⟳",
        [PbChat_DownloadState.Downloaded]: "✔",
    }[state ?? PbChat_DownloadState.NotDownloadable]
}

function FileMessage({ msg }: { msg: MessageView }): React.ReactNode {
    const subj = msg.body.oneofKind === 'file' ? msg.body.file : null as never;
    if (subj.download) {
        return <>
            <MessageSummary msg={msg} />
            {(subj.state ?? 0) >= PbChat_DownloadState.Downloading && <FileState state={subj.state} />}
        </>
    } else if (msg.mine) {
        return <span className="underline">
            <MessageSummary msg={msg} />
        </span>
    } else if (subj?.state === PbChat_DownloadState.Downloadable) {
        return <span className="underline cursor-pointer" onClick={() => Chat.do.download(msg)}>
            <MessageSummary msg={msg} /> <FileState state={subj.state} />
        </span>
    } else {
        return <span className="underline text-gray-400">
            <MessageSummary msg={msg} /> <FileState state={subj.state} />
        </span>
    }
}

function ImgMessage({ msg }: { msg: MessageView }): React.ReactNode {
    const subj = msg.body.oneofKind === 'img' ? msg.body.img : null as never;
    return msg.imgUrl
        ? (
            <a href={msg.imgUrl} target="_blank" className="max-h-96 flex justify-center items-center overflow-hidden">
                <Image src={msg.imgUrl} width={subj.width} height={subj.height} className="object-contain" alt={subj.file?.name || ''} />
            </a>
        ) : (
            <span className="flex items-center">
                <span className="text-6xl">☒</span>
                <span>{subj.file?.name}</span>
            </span>
        );
}

export function MessageBox({ msg }: { msg: MessageView }): React.ReactNode {
    let children: React.ReactNode;
    if (msg.body.oneofKind === 'text') {
        children = msg.body.text;
    } else if (msg.body.oneofKind === 'file') {
        children = <FileMessage msg={msg} />;
    } else {
        children = <ImgMessage msg={msg} />;
    }
    return (
        <li className="flex p-2" key={msg.timeId}>
            <div className="mt-1 mr-2 w-9 text-3xl ">{msg.mine || "😶"}</div>
            <div className={"flex-1 flex flex-col " + (msg.mine ? "items-end" : "items-start")}>
                <p className="text-sm">
                    <span className="text-gray-700">{msg.user?.nick}</span>
                    <span className="ml-2 text-gray-500"><MessageTime msg={msg} /></span>
                </p>
                <p className={"mt-1 p-1 pl-3 pr-3 rounded-lg leading-6 text-sm break-all whitespace-pre-wrap " + (msg.mine ? "bg-sky-500 text-white" : "bg-gray-100")}>
                    {children}
                </p>
            </div>
            <div className="mt-1 ml-2 w-9 text-3xl ">{msg.mine && "😶"}</div>
        </li>
    )
}

export class QrcodeScanner {
    private html5qrcode!: Html5Qrcode;

    public async render(elementId: string, width: number, onDecoded: (decoded: string) => void, onError?: (err: string|Error) => void) {
        try {
            await Html5Qrcode.getCameras();
        } catch (_) {
            if (onError) onError(new Error('未检测到摄像头'));
            return;
        }
        let errored = false;
        this.html5qrcode = new Html5Qrcode(elementId, true);
        this.html5qrcode.start({
            facingMode: 'environment',
        }, {
            fps: 10,
            qrbox: {
                width,
                height: width
            },
            aspectRatio: 1,
        }, onDecoded, err => {
            if (errored) return;
            errored = true;
            onError && onError(err);
        });
    }

    public unload() {
        if (!this.html5qrcode) return;
        this.html5qrcode.stop().then(() => this.html5qrcode.clear());
    }

    public setTorch(torch: boolean) {
        if (!this.html5qrcode || !(this.html5qrcode.getRunningTrackCapabilities() as MediaTrackCapabilities & {torch: boolean}).torch) return;
        this.html5qrcode.applyVideoConstraints({ advanced: [{ torch } as MediaTrackConstraintSet]});
    }

    public zoom(zoom: number) {
        if (!this.html5qrcode) return;
        const zoomCapabilities = (this.html5qrcode.getRunningTrackCapabilities() as MediaTrackCapabilities & { zoom: DoubleRange & { step: number } }).zoom;
        if (zoomCapabilities?.max === undefined || zoomCapabilities?.min === undefined) return;
        const step = zoomCapabilities.step ?? 0.1;
        const totalStep = (zoomCapabilities.max - zoomCapabilities.min) / step;
        zoom = zoomCapabilities.min + Math.round(totalStep * zoom / 100) * step;
        if (zoom > zoomCapabilities.max) zoom = zoomCapabilities.max;
        this.html5qrcode.applyVideoConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] });
    }

    private static instance: QrcodeScanner;
    public static get one(): QrcodeScanner {
        if (! this.instance) {
            this.instance = new QrcodeScanner();
        }
        return this.instance;
    }
}