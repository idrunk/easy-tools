'use client'

import { WebRTCCommunicator, WebRTCRouter } from "@/lib/communicator/comm-wrtc";
import { ConnectionState, LongCommunicator } from "@/lib/communicator/long";
import { PbChat, PbChat_DownloadState, PbChat_Message, PbTransporter, PbUser } from "@/lib/model/et/et";
import { PbTopic } from "@/lib/model/et/et.go";
import { exportStream, readToLines } from "@/lib/utils/file";
import { debounce, sortDeduplicateMergeTo, TimeId } from "@/lib/utils/mixed";
import Dexie, { EntityTable } from "dexie";
import { redirect } from "next/navigation";
import { Receiver, Sender, TransportPath } from "./transporter";
import log from "@/lib/utils/log";

const MsgPath = 'msg';

export class Chat {
    private messages: MessageView[] = []

    public sendText(message: string) {
        const msg = Chat.genPbMessage(TimeId.get, 'text', message);
        this.brocast(msg);
    }

    private brocast(msg: PbChat_Message) {
        this.pushPbMessages([msg]);
        this.renderMessage();
        const pkg = this.packPbMessage([msg]);
        // 广播给全部会话成员
        this.wrtc.broadcast(MsgPath, PbChat.toBinary(pkg));
    }

    private packPbMessage(msgs: PbChat_Message[]): PbChat {
        return PbChat.create({ pack: msgs, user: { id: this.wrtc.pp, nick: this.wrtc.ip } });
    }

    private pushPbMessages(messages: PbChat_Message[], user?: PbUser, target?: PbUser): void {
        const messageEntities = messages.map(msg => Object.assign(msg, {
            topicId: this.options.topic.id,
            user: user || {
                id: this.wrtc.pp,
                nick: this.wrtc.ip,
            },
            target,
            mine: !user,
        }))
        // 所有Protobuf消息都需缓存到本地，从本地加载的消息则无需缓存，应调用`pushEntityMessages`
        this.cacheMessages(messageEntities);
        return this.pushEntityMessages(messageEntities);
    }

    private pushEntityMessages(messages: MessageEntity[]): void {
        const appends = messages.map(Chat.messageEntityToView);
        sortDeduplicateMergeTo(this.messages, appends, (a, b) => a.timeId < b.timeId ? -1 : Number(a.timeId > b.timeId));
    }

    public static messageEntityToView(msg: MessageEntity): MessageView {
        return Object.assign(msg, { sendTime: TimeId.parse(msg.timeId).getTime() });
    }

    private renderMessage() {
        if (!this.options?.renderMessages) return;
        this.loadImages();
        this.options.renderMessages([...this.messages]);
    }

    private packFileMessage(file: File, imgSize?: [number, number]): PbChat_Message {
        const fileId = Sender.listFile(file);
        const pbFile = {
            id: fileId,
            name: file.name,
            type: file.type,
            size: BigInt(file.size),
            modified: BigInt(Math.abs(file.lastModified)),
            state: PbChat_DownloadState.Downloadable,
        };
        return imgSize 
            ? Chat.genPbMessage(TimeId.get, 'img', { file: pbFile, width: imgSize[0], height: imgSize[1] })
            : Chat.genPbMessage(TimeId.get, 'file', pbFile);
    }

    public sendFile(file: File) {
        const msg = this.packFileMessage(file);
        this.brocast(msg);
    }

    public async download(msg: MessageView) {
        const file = msg.body.oneofKind === 'file' ? msg.body.file : null as never;
        const conn = this.wrtc.connBy(msg.user.id);
        if (!conn) return;
        const reqMsg = Chat.genPbMessageBy(msg, 'file', Object.assign({ download: true }, file));
        // 本地渲染（记录文件主，以避免自动推送时将其推给了非文件主）
        this.pushPbMessages([reqMsg], undefined, msg.user);
        this.renderMessage();
        // 发送下载消息给文件主
        const reqMsgPack = this.packPbMessage([reqMsg]);
        conn.send(MsgPath, PbChat.toBinary(reqMsgPack));
        // 请求下载文件
        const readable = await Receiver.inst(reqMsg.timeId, conn).request(file.id);
        // log.debug('readable', readable, 'reqMsg', reqMsg);
        exportStream(readable, reqMsg.body.oneofKind === 'file' ? reqMsg.body.file.name : String(new Date().getTime()));
    }

    private static AllowedMaxImg = 16 * 1024 * 1024
    public async sendImage(file: File) {
        if (file.size >= Chat.AllowedMaxImg) throw new Error('图片过大，请以文件形式发送。');
        const size = await this.imageSize(file);
        const msg = this.packFileMessage(file, size);
        this.brocast(msg);
    }

    private loadImages() {
        this.messages
            .filter(msg => msg.body.oneofKind === 'img' && ! msg.imgUrl)
            .forEach(msg => msg.mine ? this.loadLocalImage(msg) : this.loadRemoteImage(msg));
    }

    // 加载本地图片文件
    private loadLocalImage(msg: MessageView) {
        const img = msg.body.oneofKind === 'img' ? msg.body.img : null as never;
        const file = Sender.fileById(img.file?.id || '');
        if (! file) return;
        msg.imgUrl = URL.createObjectURL(file);
        this.renderMessage();
    }

    // 加载远程图片
    private async loadRemoteImage(msg: MessageView) {
        const conn = this.wrtc.connBy(msg.user.id);
        if (!conn) return;
        const img = msg.body.oneofKind === 'img' ? msg.body.img : null as never;
        const readable = await Receiver.inst(msg.timeId, conn).request(img.file?.id || '');
        const response = new Response(readable);
        const respBlob = await response.blob();
        const blob = new Blob([respBlob], {type: img.file?.type});
        msg.imgUrl = URL.createObjectURL(blob);
        this.renderMessage();
    }

    private async imageSize(file: File): Promise<[number, number]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                if (typeof e.target?.result === 'string') {
                    const img = new Image();
                    img.onload = () => resolve([img.width, img.height]);
                    img.onerror = ie => reject(ie);
                    img.src = e.target.result;
                } else {
                    reject('File load failed.');
                }
            }
            reader.onerror = e => reject(e);
            reader.readAsDataURL(file);
        });
    }

    private cacheMessages(messages: MessageEntity[]) {
        if (messages.length < 1) return;
        Chat.db.message.bulkPut(messages);
        this.cacheTopic(messages[messages.length - 1]);
    }

    private cacheTopic = debounce(async (msg: MessageEntity) => {
        const ct = await Chat.db.topic.get(this.options.topic.id);
        if (ct?.lastMsg && ct.lastMsg.timeId >= msg.timeId) {
            return;
        }
        const topic = Object.assign({lastMsg: msg}, this.options.topic);
        Chat.db.topic.put(topic);
    })

    private listenMessage() {
        this.wrtc.listen(
            MsgPath,
            resp => resp.arrayBuffer()
                .then(ab => PbChat.fromBinary(new Uint8Array(ab)))
                .then(c => {
                    this.pushPbMessages(c.pack, c.user);
                    this.renderMessage();
                })
        );
    }

    private listenTransport() {
        this.wrtc.listen(
            TransportPath,
            (resp, communicator) => resp.arrayBuffer()
                .then(ab => PbTransporter.fromBinary(new Uint8Array(ab)))
                .then(t => {
                    log.debug('t', t);
                    if (['meta', 'load', 'code'].some(kind => kind === t.container.oneofKind)) {
                        Receiver.inst(t.msgId, communicator as WebRTCCommunicator).handle(t);
                    } else {
                        const sender = Sender.inst(t.msgId, communicator as WebRTCCommunicator);
                        sender.bind({
                            onSendProgress() {
                                log.debug('msgId:', this.reqId, 'speed:', this.speed, 'progress:', this.progress);
                            },
                        })
                        sender.handle(t);
                    }
                })
        );
    }

    private clearListen() {
        this.wrtc.unlisten(MsgPath, "file");
    }

    private renderUserList() {
        if (!this.options?.renderUsers) return;
        const users: UserView[] = [{
            id: this.wrtc.pp,
            nick: this.wrtc.ip,
            mine: true,
        }];
        users.push(...this.wrtc.filter().map(conn => ({
            id: conn.pp,
            nick: conn.ip,
            online: conn.state === ConnectionState.Connected,
        })));
        this.options.renderUsers(users);
    }

    private async loadLocal() {
        this.messages = [];
        const messages = await Chat.db.message.where('topicId').equals(this.options.topic.id).toArray();
        if (messages?.length > 0) {
            this.pushEntityMessages(messages);
            this.renderMessage();
        }
    }

    private syncLocalLog(conn: LongCommunicator) {
        // 将我的非指定目标的消息发送到对端
        const localMessages = this.messages.filter(mv => mv.mine && !mv.target);
        if (localMessages.length < 1) return;
        const pkg = this.packPbMessage(localMessages);
        // 将自己本地消息发送给新连接成员
        this.wrtc.send(conn.address, 'msg', PbChat.toBinary(pkg));
    }

    private get wrtc(): WebRTCRouter {
        return WebRTCRouter.inst(this.options.topic.id, {
            stateChange: (state, before, conn) => {
                if (state === ConnectionState.Connected && before === ConnectionState.Connected
                    || state !== ConnectionState.Connected && before !== ConnectionState.Connected) {
                    return;
                }
                this.renderUserList();
                state === ConnectionState.Connected && this.syncLocalLog(conn);
            }
        });
    }

    private options!: ChatOptions;
    private delayedBinding!: number;

    public bind(options: ChatOptions) {
        this.options = options;
        this.delayedBinding = setTimeout(() => {
            this.delayedBinding = 0;
            this.loadLocal();
            this.listenMessage();
            this.listenTransport();
            this.renderUserList();
        }, 100) as any as number;
    }

    public unbind() {
        if (this.delayedBinding) {
            clearTimeout(this.delayedBinding);
            this.delayedBinding = 0;
        } else {
            this.clearListen();
        }
        this.options.renderMessages = undefined;
        this.options.renderUsers = undefined;
    }

    public static genPbMessage<K extends PbMessageKind>(timeId: string, kind: K, value: PbMessageValue<K>): PbChat_Message {
        return PbChat_Message.create({
            timeId,
            body: {
                oneofKind: kind,
                [kind]: value,
            } as any
        });
    }

    public static genPbMessageBy<K extends PbMessageKind>(referent: PbChat_Message, kind: K, value: PbMessageValue<K>): PbChat_Message {
        return Object.assign({}, referent, { timeId: TimeId.get, body: { oneofKind: kind, [kind]: value, } })
    }

    private static inst: Chat;
    public static get do(): Chat {
        if (! this.inst) {
            this.inst = new Chat();
        }
        return this.inst;
    }

    private static dexie: Dexie;
    private static get db(): Dexie & {
        topic: EntityTable<TopicEntity, 'id'>,
        message: EntityTable<MessageEntity, 'timeId'>,
    } {
        if (!this.dexie) {
            this.dexie = new Dexie('EasyTranfer');
            this.dexie.version(1).stores({
                topic: 'id, key, lastMsg.timeId',
                message: 'timeId, topicId',
            });
        }
        return this.dexie as any;
    }

    public static async topicList(): Promise<TopicView[]> {
        return this.db.topic.toArray().then(topics => 
            topics.map(topic => Object.assign(topic, { lastMsgTime: TimeId.parse(topic.lastMsg?.timeId || "").getTime() })));
    }

    public static clear() {
        if (! this.do.options?.topic.id) {
            return alert('未指定会话');
        } else if (! confirm("清除后无法恢复，确定要继续吗？")) {
            return;
        }
        this.db.message.where('topicId').equals(this.do.options.topic.id).delete();
        this.db.topic.delete(this.do.options.topic.id);
        redirect('/et/');
    }

    public static clearAll() {
        if (!confirm("你正在清除全部会话数据，清除后将无法恢复，确定要继续吗？")) return;
        this.db.message.clear();
        this.db.topic.clear();
        redirect('/et/');
    }

    private static TOPIC_LABEL = '###TOPIC###'
    private static MESSAGES_LABEL = '###MESSAGES###'
    private static async writeTopic(writer: WritableStreamDefaultWriter<any>, topic?: TopicEntity|string) {
        const jsonToLineBytes = (obj: any) => new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
        typeof topic === 'string' && (topic = await this.db.topic.get(topic));
        if (!topic) return;
        writer.write(jsonToLineBytes(this.TOPIC_LABEL));
        writer.write(jsonToLineBytes(topic));
        const messages = await this.db.message.where('topicId').equals(topic.id).toArray();
        if (messages.length > 0) {
            writer.write(jsonToLineBytes(this.MESSAGES_LABEL));
            messages.forEach(msg => writer.write(jsonToLineBytes(msg)));
        }
    }

    public static async export() {
        const { writable, readable } = new TransformStream();
        const writer = writable.getWriter();
        await this.writeTopic(writer, this.do.options.topic.id);
        writer.close();
        exportStream(readable, `tid-${this.do.options.topic.id}.etlog`);
    }

    public static async exportAll() {
        const { writable, readable } = new TransformStream();
        const writer = writable.getWriter();
        const topics = await this.db.topic.toArray();
        for (const topic of topics)
            await this.writeTopic(writer, topic);
        writer.close();
        exportStream(readable, `all-topics.etlog`);
    }

    public static async import(files: FileList) {
        const file = files[0];
        if (! file || ! confirm("所有记录将增量覆盖式导入，确定要继续吗？")) return;
        let currentLabel;
        const topics: TopicEntity[] = [];
        const messages: MessageEntity[] = [];
        const lines = await readToLines(file);
        for (const line of lines) {
            if ('' === line.trim()) continue;
            const item = JSON.parse(line);
            if (item === this.TOPIC_LABEL) {
                currentLabel = this.TOPIC_LABEL;
            } else if (item === this.MESSAGES_LABEL) {
                currentLabel = this.MESSAGES_LABEL;
            } else if (currentLabel === this.TOPIC_LABEL) {
                topics.push(item);
            } else {
                messages.push(item);
            }
        }
        topics.length > 0 && this.db.topic.bulkPut(topics);
        messages.length > 0 && this.db.message.bulkPut(messages);
        alert(`成功导入了 ${topics.length} 个主题及 ${messages.length} 条对话`)
        redirect(`/et/${this.do.options.topic.id}`);
    }
}

type PbMessageKind = Exclude<PbChat_Message['body']['oneofKind'], undefined>;
// @ts-ignore
type PbMessageValue<K extends PbMessageKind> = Extract<PbChat_Message['body'], { oneofKind: K }>[K];

export interface TopicEntity extends PbTopic {
    lastMsg: MessageEntity,
}

export interface TopicView extends TopicEntity {
    lastMsgTime: Date,
}

interface MessageEntity extends PbChat_Message {
    topicId: string,
    user: PbUser,
    target?: PbUser,
    mine: boolean,
}

export interface MessageView extends MessageEntity {
    sendTime: Date,
    imgUrl?: string,
}

export interface UserView {
    id: string,
    nick: string,
    online?: boolean,
    mine?: boolean,
}

export interface ChatOptions {
    topic: PbTopic,
    renderMessages?: (msg: MessageView[]) => void,
    renderUsers?: (msg: UserView[]) => void,
}