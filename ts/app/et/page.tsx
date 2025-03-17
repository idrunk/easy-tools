"use client"

import Image from "next/image";
import Link from "next/link";
import QrScan from "@/img/qrcode-scan-128.png"
import { useEffect, useState } from "react";
import { useToast } from "@/lib/ui/toast";
import { redirect } from "next/navigation";
import { Chat, TopicView } from "./lib";
import { MessageSummary, MessageTime } from "./units";

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
                    {/* <Link className="w-20 h-20 relative" href="/scanner"> */}
                    <button className="w-20 h-20 relative" onClick={() => toast("暂未实现，请使用浏览器或微信的扫一扫")}>
                        <Image src={QrScan} alt="Qrcode scan" fill />
                    </button>
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