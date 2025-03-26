"use client"

import Image from "next/image";
import Link from "next/link";
import QrScan from "@/img/qrcode-scan-128.png"
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/lib/ui/toast";
import { redirect } from "next/navigation";
import { Chat, TopicView } from "./lib";
import { MessageSummary, MessageTime, QrcodeScanner } from "./units";

export default function EasyTransfer() {
    const toast = useToast();
    const [targetTid, setTargetTid] = useState("");
    const joinSession = () => {
        const matches = targetTid.match(/^(?:.+\/et\/)?([\w-]{5,})/);
        if (!matches) return toast("输入ID无效");
        redirect(`/et/${matches?.[1]}`);
    }
    const [topics, setTopics] = useState([] as TopicView[]);
    useEffect(() => {
        Chat.topicList().then(topics => setTopics(topics));
    }, []);

    const maxCameraWidth = 320;
    const cameraPadding = 15;
    const cameraWidth = useRef(maxCameraWidth);
    const [scannerOpened, setScannerOpened] = useState(false);
    const scannerBoxId = 'scanner-box-id';
    const openScanner = () => setScannerOpened(true);
    const closeScanner = () => {
        QrcodeScanner.one.unload();
        setScannerOpened(false);
    }
    useEffect(() => {
        if (window?.innerWidth < maxCameraWidth + cameraPadding * 2) cameraWidth.current = window?.innerWidth - cameraPadding * 2;
        scannerOpened && setTimeout(() => QrcodeScanner.one.render(scannerBoxId, cameraWidth.current, decoded => {
            if (/^https:\/\//.test(decoded)) {
                closeScanner();
                location.href = decoded;
            }
        }, err => err instanceof Error && toast(err.message)), 0);
    }, [scannerOpened]);
    const zoomScanner = (value: number) => QrcodeScanner.one.zoom(value);
    const [torch, setTorch] = useState(false);
    useEffect(() => {
        QrcodeScanner.one.setTorch(torch);
    }, [torch]);
    return (
        <div className="p-2">
            <div className="flex flex-row h-24">
                <form action={joinSession} className="flex flex-col place-content-around flex-1 pr-1">
                    <input onChange={e=>setTargetTid(e.target.value)} value={targetTid} className="text-sm indent-2 h-8 border rounded" placeholder="输入ID加入目标会话" />
                    <div className="flex gap-2">
                        <button className="flex-1 border rounded w-full h-8 text-sm" type="submit">加 入</button>
                        <Link className="flex-1" href="/et/new">
                            <button className="rounded w-full h-8 bg-[#1677ff] text-white text-sm">新 会 话</button>
                        </Link>
                    </div>
                </form>
                <div className="w-24 h-24 flex justify-center items-center">
                    <button className="w-20 h-20 relative" onClick={openScanner}>
                        <Image src={QrScan} alt="Qrcode scan" fill />
                    </button>
                    {scannerOpened  && <div className="fixed w-screen h-screen left-0 top-0 flex flex-col justify-center items-center bg-slate-500">
                        <div style={{ width: cameraWidth.current }}>
                            <div className="flex justify-between">
                                <button onClick={() => setTorch(!torch)} className="border border-sky-500 rounded p-1 pl-4 pr-4 text-sm text-white bg-sky-500">
                                    {torch ? '关灯' : '开灯'}
                                </button>
                                <button onClick={closeScanner} className="border border-sky-500 rounded p-1 pl-4 pr-4 text-sm text-white bg-sky-500">返回</button>
                            </div>
                            <div className="mt-4">
                                <div id={scannerBoxId} style={{ width: cameraWidth.current, height: cameraWidth.current }}></div>
                            </div>
                            <div className="mt-4">
                                <input type="range" min={0} max={100} defaultValue={0} onChange={e => zoomScanner(parseInt(e.target.value))} className="w-full" />
                            </div>
                        </div>
                    </div>}
                </div>
            </div>
            <div className="mt-3">
                <h3 className="border-b border-gray-200">
                    <span className="inline-block border-b p-2 pt-0 border-blue-500">当前会话</span>
                </h3>
                <ul className="pt-2 pb-2">
                    {topics.map(SessionTopic)}
                </ul>
            </div>
        </div>
    )
}

function SessionTopic(topic: TopicView) {
    const lastMsgView = Chat.messageEntityToView(topic.lastMsg);
    return (
        <li className="pl-1 pr-1 pt-2 pb-2 rounded hover:bg-gray-100" key={topic.id}>
            <Link className="flex text-sm" href={`/et/${topic.id}`}>
                {topic.key && <span className="mr-2">[{topic.key}]</span>}
                <span className="flex-1 truncate"><MessageSummary msg={lastMsgView} /></span>
                <span className="text-gray-400"><MessageTime msg={lastMsgView} /></span>
            </Link>
        </li>
    )
}