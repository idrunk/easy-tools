"use client"

import App from "@/lib/app/app"
import { PbTopic } from "@/lib/model/et/et.go"
import { useToast } from "@/lib/ui/toast"
import dynamic from "next/dynamic"
import { redirect, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function ({ tid, topic, code }: { tid: string, topic?: PbTopic, code: number }) {
    if (topic) {
        const Chat = dynamic(() => import('./chat'), { ssr: false });
        return <Chat tid={tid} topic={topic} />;
    } else if (code === 404) {
        const [countdown, setCountdown] = useState(6);
        useEffect(() => {
            if (countdown <= 0) redirect(`/et/`);
            const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        })
        return <p className="h-full flex justify-center items-center">会话不存在或已过期，将在 {countdown} 秒后返回</p>;
    }

    const router = useRouter();
    const toast = useToast();
    const [tSecret, setTSecret] = useState("");
    const authorize = async () => {
        if (tSecret.length < 1) return toast("请输入会话密码");
        const pbTopic = PbTopic.create();
        pbTopic.key = tid;
        pbTopic.secret = tSecret;
        await App.ch.post(`api/et/${tid}/auth`, PbTopic.toJsonString(pbTopic)).then(() => {
            router.refresh();
        }).catch(() => {
            setTSecret("");
            toast("密码错误，请重试。");
        })
    }
    return (
        <form action={authorize} className="md:w-80 md:justify-center max-md:p-3 h-full mx-auto flex flex-col space-y-3">
            <p className="text-gray-600">此为私密会话，请输入密码访问</p>
            <p className="text-gray-500">会话ID：<span className="text-gray-800 text-sm">{tid}</span></p>
            <input className="border rounded p-1 pl-2 pr-2" onChange={e => setTSecret(e.target.value)} value={tSecret} placeholder="请输入会话密码" type="password" />
            <button className="border rounded p-1">提 交</button>
        </form>
    )
}