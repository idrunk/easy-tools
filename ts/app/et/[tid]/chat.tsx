"use client"

import QRCode from 'qrcode'
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize"
import { MessageBox } from "../units";
import App from "@/lib/app/app";
import { PbTopic } from "@/lib/model/et/et.go";
import { Status } from '@/lib/model/status';
import { useToast } from '@/lib/ui/toast';
import { Chat, MessageView, UserView } from '../lib';
import usePopup from '@/lib/ui/popup';
import { FileSelector } from '@/lib/ui/file-selector';
import { debounce } from '@/lib/utils/mixed';
import { WebRTCRouter } from '@/lib/communicator/comm-wrtc';

export default function ({ tid, topic }: { tid: string, topic: PbTopic }) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [sidePopup, setSidePopup] = useState(false);
    const [input, setInput] = useState("");
    const [users, setUsers] = useState([] as UserView[]);
    const [messages, setMessages] = useState([] as MessageView[]);
    const [scrollable, setScrollable] = useState(true);
    const listRef = useRef(null as any as HTMLDivElement);
    const { showPopup, Popup } = usePopup({ maxWidth: 360 });
    const toast = useToast();

    !WebRTCRouter.isSupported() && toast('您的浏览器不支持 WebRTC 技术，请用谷歌或微信等浏览器使用本工具。');

    const sendMessage = (msg: string) => {
        Chat.do.sendText(msg);
        setInput("");
        scrollToBottom();
    }
    const sendFile = async (files: FileList, sendImage?: boolean) => {
        const file = files[0];
        if (! file) return;
        try {
            sendImage ? await Chat.do.sendImage(file) : Chat.do.sendFile(file);
            scrollToBottom();
        } catch (e) {
            toast(String(e));
        }
    }
    useEffect(() => {
        Chat.do.bind({
            topic: topic,
            renderUsers: us => setUsers(us),
            renderMessages: msgs => setMessages(msgs),
        });
        return () => Chat.do.unbind();
    }, []);

    const switchScrollable = () => setScrollable(listRef.current.scrollTop >= listRef.current.scrollHeight - listRef.current.clientHeight);
    const scrollToBottom = () => setTimeout(() => listRef.current.scrollTop = listRef.current.scrollHeight - listRef.current.clientHeight, 0);
    useEffect(() => {
        scrollable && scrollToBottom();
    }, [messages]);

    return (
        <div className="h-full md:p-2">
            <Popup>
                <p className='text-sm text-gray-600'>所有会话数据均存于您本地浏览器，请妥善管理，我们不对数据的丢失、泄露等负任何责任。</p>
                <div className='mt-4 flex flex-wrap gap-x-3 gap-y-2'>
                    <button onClick={() => Chat.clear()} className='rounded p-2 pl-3 pr-3 text-sm border border-[#ff4d4f] bg-[#ff4d4f] text-white'>清除当前记录</button>
                    <button onClick={() => Chat.clearAll()} className='rounded p-2 pl-3 pr-3 text-sm border border-[#ff4d4f] bg-[#ff4d4f] text-white'>清除全部记录</button>
                </div>
                <div className='mt-4 flex flex-wrap gap-x-3 gap-y-2'>
                    <button onClick={() => Chat.export()} className='rounded p-2 pl-3 pr-3 text-sm border'>导出当前记录</button>
                    <button onClick={() => Chat.exportAll()} className='rounded p-2 pl-3 pr-3 text-sm border'>导出全部记录</button>
                    <FileSelector onFiles={files => Chat.import(files)} className='rounded p-2 pl-3 pr-3 text-sm border'>导入记录</FileSelector>
                </div>
            </Popup>
            <div className="flex md:border md:rounded border-t h-full overflow-hidden">
                <div className="flex-1 h-full flex flex-col">
                    <div className="flex-1 relative overflow-y-auto" onScroll={debounce(switchScrollable)} ref={listRef}>
                        {sidePopup && <div className="sticky w-full h-full top-0 flex flex-col bg-white p-2">
                            <SideContent users={users} topic={topic} tid={tid} />    
                        </div>}
                        <ul>{messages.map(msg => <MessageBox msg={msg} key={msg.timeId} />)}</ul>
                    </div>
                    <div className="border-t p-3 pt-2 pb-2 bg-slate-50">
                        <div className="flex items-end">
                            {menuVisible
                                ? <div className="flex-1 flex items-center gap-2 pr-2">
                                    <FileSelector onFiles={file => sendFile(file)} className="h-9 pl-1 pr-1">📂</FileSelector>
                                    <FileSelector onFiles={file => sendFile(file, true)} accept='image/png, image/jpg, image/jpeg, image/gif, image/bmp, image/webp' className="h-9 pl-1 pr-1">🖼️</FileSelector>
                                    {/* <button className="h-9 pl-1 pr-1">⚙️</button> */}
                                </div>
                                : <TextareaAutosize maxRows={16} value={input} onChange={e => setInput(e.target.value)}
                                    className="flex-1 rounded touch-none shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] outline-none resize-none caret-[#1677ff] p-2 text-sm min-h-9 transition-all" />}
                            {menuVisible && <>
                                <button className="h-9 pl-2 pr-2 text-lg" onClick={showPopup}>♻</button>
                                {window?.innerWidth <= 768 && <button className="h-9 pl-2 pr-2 pb-1 text-lg ml-1"
                                    onClick={_ => setSidePopup(!sidePopup)}>⋮</button>}
                            </>}
                            <button className={"h-9 pl-2 pr-2 ml-1 rounded transition " + (input.length > 0 && "text-sm text-white bg-[#1677ff]")}
                                onClick={_ => input.length == 0 ? setMenuVisible(!menuVisible) : sendMessage(input)}>
                                {input.length > 0 ? "发送" : "☰"}
                            </button>
                        </div>
                    </div>
                </div>
                <div className={"flex flex-col border-l p-2 " + ("max-md:hidden w-64" /*"mx-auto mt-10 max-w-full border-l-0"*/)}>
                    <SideContent users={users} topic={topic} tid={tid} />
                </div>
            </div>
        </div>
    )
}

function SideContent({ users, topic, tid }: { users: UserView[], topic: PbTopic, tid: string }): React.ReactElement {
    const toast = useToast();

    const idUrl = `${location.protocol}//${location.host}/et/${topic.id}`;
    const [idUrlQr, setIdUrlQr] = useState("");
    useEffect(() => { QRCode.toDataURL(idUrl).then(setIdUrlQr).catch(console.warn) }, []);

    const [showKeyUrl, setShowKeyUrl] = useState(tid.length < 40);
    const [sigkey, setSigkey] = useState(topic.key || "");
    const [keyUrl, setKeyUrl] = useState("");
    const [keyUrlQr, setKeyUrlQr] = useState("");

    useEffect(() => {
        if (!sigkey) return
        const keyUrl = `${location.protocol}//${location.host}/et/${sigkey}`
        setKeyUrl(keyUrl)
        QRCode.toDataURL(keyUrl).then(setKeyUrlQr).catch(console.warn)
    }, [sigkey]);

    const topicKey = useRef(topic.key);
    const topicSecret = useRef("");
    const saveKeyUrl = async () => {
        topic.key = topicKey.current;
        topic.secret = topicSecret.current;
        App.ch.patch(`api/et/${topic.id}`, PbTopic.toJsonString(topic)).then(resp => resp.text().then(txt => {
            const status = Status.fromJsonString(txt);
            if (status.status) {
                setSigkey(topic.key || "");
            } else if (status.msg) {
                toast(status.msg);
            }
        }));
    }

    return <>
        <div className="border-b overflow-hidden flex flex-col">
            <div className="pl-2 pb-2 border-b text-sm">会话成员</div>
            <div className="p-1 overflow-y-auto">
                <ul className="text-sm leading-7 text-gray-600">{users.map(m => SideUser(m))}</ul>
            </div>
        </div>
        <div>
            <div className="h-7 leading-10 text-center text-sm">扫码或复制链接加入会话</div>
            {showKeyUrl
                ? <div>
                    {keyUrlQr
                        ? <> <Image className="mx-auto" src={keyUrlQr} alt="Session qrcode" width={222} height={222} />
                            <p className="p-1 border rounded border-gray-100 text-sm text-gray-500 break-all" contentEditable suppressContentEditableWarning>{keyUrl}</p>
                        </> : <div className='flex flex-col p-1 pt-5'>
                            <input onChange={e => topicKey.current = e.target.value} defaultValue={topicKey.current} className='border rounded mb-4 p-1 text-sm h-8' placeholder='输入一个好记的链接ID' minLength={5} maxLength={32} />
                            <input onChange={e => topicSecret.current = e.target.value} defaultValue={topicSecret.current} className='border rounded mb-4 p-1 text-sm h-8' placeholder='请输入密码' />
                            <button className='border rounded p-1 text-sm hover:text-sky-600' onClick={() => saveKeyUrl()}>保 存</button>
                        </div>
                    }
                    <div className="text-center p-2">
                        <button className="underline text-sm" onClick={() => setShowKeyUrl(false)}>显示免密长连接</button>
                    </div>
                </div> : <div>
                    {idUrlQr && <Image className="mx-auto" src={idUrlQr} alt="Session qrcode" width={222} height={222} />}
                    <p className="p-1 border rounded border-gray-100 text-sm text-gray-500 break-all" contentEditable suppressContentEditableWarning>{idUrl}</p>
                    <div className="text-center p-2">
                        <button className="underline text-sm" onClick={() => setShowKeyUrl(true)}>
                            {keyUrl ? "显示短连接" : "设置短连接"}
                        </button>
                    </div>
                </div>
            }
        </div>
    </>
}

function SideUser(user: UserView): React.ReactElement {
    return <li key={user.id}>{user.nick} {user.mine
        ? "[我]"
        : (user.online || <span>[离线]</span>)
    }</li>
}