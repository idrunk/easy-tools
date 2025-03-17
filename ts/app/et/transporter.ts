'use client';

import { WebRTCCommunicator } from "@/lib/communicator/comm-wrtc";
import { PbTransporter, PbTransporter_Code, PbTransporter_Meta } from "@/lib/model/et/et";
import TimePromise from "@/lib/utils/promise";

type PbTransporterKind = Exclude<PbTransporter['container']['oneofKind'], undefined>;
// @ts-ignore
type PbTransporterValue<K extends PbTransporterKind> = Extract<PbTransporter['container'], { oneofKind: K }>[K];
type PbTransporterLoad = Extract<PbTransporter['container'], { oneofKind: 'load' }>['load'];

type ReceivedBuffers = {
    capacity: number,
    received: number,
    expires?: Date,
    resent?: number,
    blocks: Map<number, Uint8Array | undefined>,
};

export const TransportPath = 'transport';

const AckRounds = 8;
const BlockSize = 256 * 256;
// const ChunkSize = BlockSize * 160;
const ChunkSize = BlockSize;
const MaxWindowSize = 2048;
const MinWindowSize = 1;
const MaxBufferedAmount = 512 * 1024;
const BufferedAmountThreshold = 128 * 1024;

enum ReceiverState {
    Waiting = 100,
    Receiving = 101,
    Paused = 102,
    Errored = 103,
    Finished = 104,
}

enum SenderState {
    WaitingAck = 200,
    Sending = 201,
    Paused = 202,
    Errored = 203,
    Finished = 204,
}

type ReceiverEvents = {
    onReceiveStart?: (this: Receiver) => void,
    onReceiveProgress?: (this: Receiver) => void,
    onReceiveStopped?: (this: Receiver) => void,
}

type SenderEvents = {
    onSendStart?: (this: Sender) => void,
    onSendProgress?: (this: Sender) => void,
    onSendStopped?: (this: Sender) => void,
}

export abstract class Transporter {
    private _state!: ReceiverState | SenderState;
    protected set state(value: ReceiverState | SenderState) { this._state = value; }
    public get state() { return this._state; }

    public error?: PbTransporter_Code;
    public size!: number;
    private lastProgress: number = 0;

    protected constructor(
        protected reqId: string,
        protected communicator: WebRTCCommunicator,
    ) { }

    public abstract get progress(): number;

    public get speed(): number {
        const speed = (this.progress - this.lastProgress) * Number(this.size);
        this.lastProgress = this.progress;
        return speed;
    }

    protected events!: ReceiverEvents & SenderEvents;
    public bind(events: ReceiverEvents & SenderEvents) {
        if (this instanceof Receiver) {
            if (events.onReceiveStart) events.onReceiveStart = events.onReceiveStart;
            if (events.onReceiveProgress) {
                events.onReceiveProgress = events.onReceiveProgress;
                TickCall.one.put('receiving', events.onReceiveProgress);
            }
            if (events.onReceiveStopped) events.onReceiveStopped = events.onReceiveStopped;
        } else if (this instanceof Sender) {
            if (events.onSendStart) events.onSendStart = events.onSendStart;
            if (events.onSendProgress) {
                events.onSendProgress = events.onSendProgress;
                TickCall.one.put('sending', events.onSendProgress);
            }
            if (events.onSendStopped) events.onSendStopped = events.onSendStopped;
        }
        this.events = events;
    }

    public unbind() {
        this.events = {};
        TickCall.one.del('receiving', 'sending');
    }

    public static genPbTransporter<K extends PbTransporterKind>(msgId: string, loadId: string, kind: K, value: PbTransporterValue<K>): PbTransporter {
        return PbTransporter.create({
            msgId,
            loadId,
            container: {
                oneofKind: kind,
                [kind]: value,
            } as any
        });
    }

    public static genPbTransporterBy<K extends PbTransporterKind>(referent: PbTransporter, kind: K, value: PbTransporterValue<K>): PbTransporter {
        return Object.assign({}, referent, { container: { oneofKind: kind, [kind]: value, } })
    }
}

export class Receiver extends Transporter {
    private totalBlock!: number;
    private blockIndex = 0;
    private maxAckIndex!: number;
    private blockBuffers: Map<number, ReceivedBuffers> = new Map();
    private writer!: WritableStreamDefaultWriter;

    public get progress(): number {
        return this.blockIndex / this.totalBlock;
    }

    // 发送下载请求
    public async request(loadId: string): Promise<ReadableStream> {
        const req = Receiver.genPbTransporter(this.reqId, loadId, 'startOrEnd', true);
        this.communicator.send(TransportPath, PbTransporter.toBinary(req));
        console.log(req);
        return TimePromise.register(TransportPath, this.reqId, 8000, 'Request failed, response timed out.');
    }

    // 开始下载（以meta信息初始化类属性）
    private handleStart(meta: PbTransporter_Meta, transporter: PbTransporter) {
        this.state = ReceiverState.Receiving;
        this.size = Number(meta.size) || 0;
        this.totalBlock = Math.ceil(Number(this.size) / BlockSize);
        this.maxAckIndex = this.totalBlock - (this.totalBlock % AckRounds || AckRounds);
        const promise = TimePromise.get(TransportPath, this.reqId);
        if (promise) {
            const { readable, writable } = new TransformStream();
            promise.resolve(readable);
            this.writer = writable.getWriter();
            console.log(this);
        }
        this.events?.onReceiveStart && this.events.onReceiveStart.call(this);
        // 发送 0 值ack以便告知发送器开始发送数据
        const sig = Receiver.genPbTransporterBy(transporter, 'ack', 0);
        this.communicator.send(TransportPath, PbTransporter.toBinary(sig));
}

    private handleStop(code?: PbTransporter_Code) {
        if (code === undefined) {
            this.state = ReceiverState.Finished;
        } else {
            this.state = ReceiverState.Errored;
            this.error = code;
        }
        this.writer && this.writer.close();
        this.events?.onReceiveStopped && this.events.onReceiveStopped.call(this);
        Receiver.removeInstance(this);
    }

    private handleWrite(roundBuffers: ReceivedBuffers) {
        if (!this.writer) return;
        let index = 0;
        const finalBlock = new Uint8Array(roundBuffers.capacity);
        roundBuffers.blocks.forEach(block => finalBlock.set(block as Uint8Array, (index++) * BlockSize));
        // 合并写入优化IO
        console.log(finalBlock);
        this.writer.write(finalBlock);
    }

    private handleLoad(load: PbTransporterLoad, transporter: PbTransporter) {
        console.log(load.index, this.blockIndex, this.maxAckIndex);
        const ackIndex = load.index - (load.index % AckRounds);
        const isLastRound = ackIndex >= this.maxAckIndex;
        const buffersLenth = !isLastRound ? AckRounds : this.totalBlock % AckRounds || AckRounds;
        let roundBuffers = this.blockBuffers.get(ackIndex);
        if (!roundBuffers) {
            roundBuffers = {
                capacity: isLastRound ? this.size - BlockSize * ackIndex : BlockSize * AckRounds,
                received: 0,
                blocks: new Map(Array.from({ length: buffersLenth }).map((_, i) => [i + ackIndex, undefined])),
            };
            this.blockBuffers.set(ackIndex, roundBuffers);
        }
        roundBuffers.blocks.set(load.index, load.body);
        roundBuffers.received ++;
        console.log(this.maxAckIndex, this.blockIndex, ackIndex, this.blockIndex === ackIndex);
        // 是否写块轮次（由于网络波动可能导致新块先到，由于需追加写入，所以仅当写入轮次时才进入写入逻辑，否则只在Map缓存）
        if (this.blockIndex === ackIndex) {
            console.log(isLastRound, roundBuffers);
            // 如果轮次缓存已全部收到，则递增代写索引，发送ack
            // （后续考虑超时重发机制，如一直未收到某块，则请求重发）
            if (roundBuffers.received >= roundBuffers.blocks.size) {
                this.handleWrite(roundBuffers);
                let sig: PbTransporter;
                if (isLastRound) {
                    sig = Receiver.genPbTransporterBy(transporter, 'startOrEnd', false);
                    this.handleStop();
                } else {
                    this.blockIndex += AckRounds;
                    sig = Receiver.genPbTransporterBy(transporter, 'ack', buffersLenth);
                }
                this.communicator.send(TransportPath, PbTransporter.toBinary(sig));
                this.blockBuffers.delete(ackIndex);
            }
        }
    }

    public handle(transporter: PbTransporter) {
        if (transporter.container.oneofKind === 'load') {
            this.handleLoad(transporter.container.load, transporter);
        } else if (transporter.container.oneofKind === 'meta') {
            this.handleStart(transporter.container.meta, transporter);
        } else if (transporter.container.oneofKind === 'code') {
            this.handleStop(transporter.container.code);
        }
    }

    private static instanceMapping: Map<string, Receiver> = new Map();
    public static inst(reqId: string, communicator?: WebRTCCommunicator): Receiver {
        if (!this.instanceMapping.has(reqId)) {
            if (!communicator) throw new Error('Communicator must be passed during initialization.');
            const receiver = new Receiver(reqId, communicator);
            receiver.state = ReceiverState.Waiting;
            this.instanceMapping.set(reqId, receiver);
        }
        return this.instanceMapping.get(reqId) as Receiver;
    }

    private static removeInstance(receiver: Receiver) {
        const reqId = this.instanceMapping.entries().find(([, v]) => v === receiver)?.[0];
        reqId && this.instanceMapping.delete(reqId);
    }

    public static connections(): MapIterator<Receiver> {
        return this.instanceMapping.values();
    }
}

export class Sender extends Transporter {
    private file!: File;
    private blockIndex = 0;
    private totalBlocks = 0;
    private inFlightPackets = 0;
    private windowSize = 5;

    public get progress(): number {
        return this.blockIndex / this.totalBlocks;
    }

    private send(transporter: PbTransporter) {
        const index = this.blockIndex++;
        if (index >= this.totalBlocks) return;
        this.inFlightPackets++;
        console.log('before send', index, this.totalBlocks);
        this.sending(transporter, index);
    }

    private sending(transporter: PbTransporter, index: number, retries: number = 0) {
        if (this.communicator.chan().bufferedAmount > MaxBufferedAmount)
            return setTimeout(() => this.sending(transporter, index), 50);
        console.log('be sending', index, this.totalBlocks);

        const offset = index * BlockSize;
        const chunk = this.file.slice(offset, offset + BlockSize);
        console.log(chunk);
        chunk.stream().getReader().read().then(({value}) => {
            if (value !== undefined) {
                const load: PbTransporterLoad = { index, body: value };
                const sig = Sender.genPbTransporterBy(transporter, 'load', load);
                console.log(sig);
                this.communicator.send(TransportPath, PbTransporter.toBinary(sig));
                // 仅当未满窗时才自动续发
                console.log(this.inFlightPackets, this.windowSize, AckRounds, this.inFlightPackets < this.windowSize || this.inFlightPackets < AckRounds);
                (this.inFlightPackets < this.windowSize || this.inFlightPackets < AckRounds) && this.send(transporter);
            } else if (retries < 3) {
                // 若读取失败，尝试自动重读
                setTimeout(() => this.sending(transporter, index, retries + 1), 50)
            } else {
                return Promise.reject('Failed to read the file.');
            }
        }).catch(() => {
            const sig = Sender.genPbTransporterBy(transporter, 'code', PbTransporter_Code.FailedToReadFile);
            this.communicator.send(TransportPath, PbTransporter.toBinary(sig));
            this.handleStop(PbTransporter_Code.FailedToReadFile);
        });
    }

    public handle(transporter: PbTransporter) {
        if (transporter.container.oneofKind === 'ack') {
            this.inFlightPackets -= transporter.container.ack;
            console.log('got ack', this.inFlightPackets);
            // 不论何原因客户端收了过多的包，都将未达计数清零
            if (this.inFlightPackets < 0) this.inFlightPackets = 0;
            if (this.communicator.chan().bufferedAmount < BufferedAmountThreshold && this.windowSize < MaxWindowSize) {
                this.windowSize ++;
            } else if (this.communicator.chan().bufferedAmount > MaxBufferedAmount && this.windowSize > MinWindowSize) {
                this.windowSize --;
            }
            this.send(transporter);
        } else if (transporter.container.oneofKind === 'startOrEnd') {
            if (transporter.container.startOrEnd) {
                this.handleStart(transporter);
            } else {
                this.handleStop();
            }
        }
    }

    private handleStart(transporter: PbTransporter) {
        const file = Sender.filePool.get(transporter.loadId);
        if (!file) {
            const sig = Sender.genPbTransporterBy(transporter, 'code', PbTransporter_Code.NonExistentLoad);
            this.communicator.send(TransportPath, PbTransporter.toBinary(sig));
            return this.handleStop(PbTransporter_Code.NonExistentLoad);
        }
        this.file = file;
        this.size = file.size;
        this.totalBlocks = Math.ceil(file.size / ChunkSize);
        this.events?.onSendStart && this.events.onSendStart.call(this);
        // 响应meta信息以便接收端初始化实例属性正式开启传输
        const sig = Sender.genPbTransporterBy(transporter, 'meta', {size: BigInt(this.size)});
        this.communicator.send(TransportPath, PbTransporter.toBinary(sig));
    }

    private handleStop(code?: PbTransporter_Code) {
        if (code === undefined) {
            this.state = SenderState.Finished;
        } else {
            this.state = SenderState.Errored;
            this.error = code;
        }
        this.events?.onSendStopped && this.events.onSendStopped.call(this);
        Sender.removeInstance(this);
    }

    private static instanceMapping: Map<string, Sender> = new Map();
    public static inst(reqId: string, communicator?: WebRTCCommunicator): Sender {
        if (!this.instanceMapping.has(reqId)) {
            if (!communicator) throw new Error('Communicator must be passed during initialization.');
            const sender = new Sender(reqId, communicator);
            sender.state = SenderState.WaitingAck;
            this.instanceMapping.set(reqId, sender);
        }
        return this.instanceMapping.get(reqId) as Sender;
    }

    private static removeInstance(sender: Sender) {
        const reqId = this.instanceMapping.entries().find(([, v]) => v === sender)?.[0];
        reqId && this.instanceMapping.delete(reqId);
    }

    public static connections(): MapIterator<Sender> {
        return this.instanceMapping.values();
    }

    private static filePool: Map<string, File> = new Map();
    // 上架本地文件，返回其ID
    public static listFile(file: File): string {
        const fileId = ((BigInt(file.size) << BigInt(48)) | (BigInt(file.lastModified) & BigInt(0xffffffffffff))).toString(36);
        !this.filePool.has(fileId) && this.filePool.set(fileId, file);
        return fileId;
    }

    public static fileById(id: string): File|undefined {
        return this.filePool.get(id);
    }
}

class TickCall {
    private ticker: ReturnType<typeof setInterval>;
    private callbacks: { [index: string]: () => void } = {};

    private constructor() {
        this.ticker = setInterval(() => Object.values(this.callbacks).forEach(callback => callback()), 1000);
    }

    public put(key: string, callback: () => void) {
        this.callbacks[key] = callback;
    }

    public del(...keys: string[]) {
        keys.forEach(key => delete this.callbacks[key]);
    }

    public clear() {
        clearInterval(this.ticker);
        this.callbacks = {};
    }

    private static instance: TickCall;
    public static get one(): TickCall {
        if (!this.instance) {
            this.instance = new TickCall();
        }
        return this.instance;
    }
}
