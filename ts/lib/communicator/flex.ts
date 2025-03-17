import { Packer, Package } from "./long"

export class FlexPacker extends Packer {
    public newPkg(path: string, body: Uint8Array|string, sid: string, id: number, numPath: number): Package {
        return FlexPackage.new(path, body, sid, id, numPath);
    }

    public serialize(pkg: Package): Uint8Array {
        return pkg.serialize();
    }

    public deserialize(seq: any): Package {
        return FlexPackage.deserialize(seq);
    }
}

export class FlexPackage extends Package {
    private static flagId = 128;
    private static flagPath = 64;
    private static flagSid = 32;
    private static flagCode = 16;
    private static flagMsg = 8;
    private static flagBody = 4;
    private static flagNumPath = 2;

    public static new(path: string, body: Uint8Array|string, sid: string, id: number, numPath: number): FlexPackage {
        return new FlexPackage().with(path, body, sid, id, numPath);
    }

    public serialize(): Uint8Array {
        const buffer = [0];
        const lenSeqInfo = [];
        const textBuffer = [];
        let seq;
        if ((this.path || "").length > 0) {
            buffer[0] |= FlexPackage.flagPath;
            textBuffer.push(seq = new TextEncoder().encode(this.path));
            lenSeqInfo.push(FlexNum.non0LenPackHead(seq.length));
        }
        if ((this.sid || "").length > 0) {
            buffer[0] |= FlexPackage.flagSid;
            textBuffer.push(seq = new TextEncoder().encode(this.sid));
            lenSeqInfo.push(FlexNum.non0LenPackHead(seq.length));
        }
        if ((this.message || "").length > 0) {
            buffer[0] |= FlexPackage.flagMsg;
            textBuffer.push(seq = new TextEncoder().encode(this.message));
            lenSeqInfo.push(FlexNum.non0LenPackHead(seq.length));
        }
        if (typeof this.body === 'string') {
            buffer[0] |= FlexPackage.flagBody;
            textBuffer.push(seq = new TextEncoder().encode(this.body));
            lenSeqInfo.push(FlexNum.non0LenPackHead(seq.length));
        } else if (this.body instanceof Uint8Array) {
            buffer[0] |= FlexPackage.flagBody;
            textBuffer.push(this.body);
            lenSeqInfo.push(FlexNum.non0LenPackHead(this.body.length));
        } // TODO maybe need to support blob and other typedArrays
        if (this.id > 0) {
            buffer[0] |= FlexPackage.flagId;
            lenSeqInfo.push(FlexNum.non0LenPackHead(this.id));
        }
        if (this.code) {
            buffer[0] |= FlexPackage.flagCode;
            lenSeqInfo.push(FlexNum.intPackHead(this.code));
        }
        if (this.numPath > 0) {
            buffer[0] |= FlexPackage.flagNumPath;
            lenSeqInfo.push(FlexNum.non0LenPackHead(this.numPath));
        }
        buffer.push(...Array(lenSeqInfo.length).fill(0))
        for (let i = 0; i < lenSeqInfo.length; i++) {
            buffer[1 + i] = lenSeqInfo[i][0];
            buffer.push(...FlexNum.packBody(lenSeqInfo[i][3], lenSeqInfo[i][2], lenSeqInfo[i][1]));
        }
        for (let i = 0; i < textBuffer.length; i++) {
            buffer.push(...textBuffer[i]);
        }
        return Uint8Array.from(buffer);
    }

    public static deserialize(buffer: any): FlexPackage {
        const seq = Array.from(new Uint8Array(buffer));
        const fp = new FlexPackage;
        const flag = seq.splice(0, 1)?.[0];
        if (!flag) {
            return fp;
        }
        const onesCount = Bit.onesCount(flag);
        const numHeadSeq = seq.splice(0, onesCount);
        if (numHeadSeq.length < onesCount) {
            return fp;
        }
        const numInfoSeq = new Array(onesCount).fill(0);
        for (let i = 0; i < onesCount; i++) {
            const tuple = FlexNum.parseHead(numHeadSeq[i], true);
            const numBodySeq = tuple[1] > 0 ? seq.splice(0, tuple[1]) : [];
            if (numBodySeq.length < tuple[1]) {
                return fp;
            }
            numInfoSeq[i] = [tuple, numBodySeq];
        }
        if ((flag & this.flagPath) > 0) {
            const [numInfo, numBodySeq] = numInfoSeq.shift();
            const len = FlexNum.non0LenParse([numInfo[3], ...numBodySeq]);
            const sq = seq.splice(0, len);
            if (sq.length < len) {
                return fp;
            }
            fp.path = new TextDecoder().decode(Uint8Array.from(sq));
        }
        if ((flag & this.flagSid) > 0) {
            const [numInfo, numBodySeq] = numInfoSeq.shift();
            const len = FlexNum.non0LenParse([numInfo[3], ...numBodySeq]);
            const sq = seq.splice(0, len);
            if (sq.length < len) {
                return fp;
            }
            fp.sid = new TextDecoder().decode(Uint8Array.from(sq));
        }
        if ((flag & this.flagMsg) > 0) {
            const [numInfo, numBodySeq] = numInfoSeq.shift();
            const len = FlexNum.non0LenParse([numInfo[3], ...numBodySeq]);
            const sq = seq.splice(0, len);
            if (sq.length < len) {
                return fp;
            }
            fp.message = new TextDecoder().decode(Uint8Array.from(sq));
        }
        if ((flag & this.flagBody) > 0) {
            const [numInfo, numBodySeq] = numInfoSeq.shift();
            const len = FlexNum.non0LenParse([numInfo[3], ...numBodySeq]);
            const sq = seq.splice(0, len);
            if (sq.length < len) {
                return fp;
            }
            fp.body = Uint8Array.from(sq);
        }
        if ((flag & this.flagId) > 0) {
            const [numInfo, numBodySeq] = numInfoSeq.shift();
            fp.id = FlexNum.non0LenParse([numInfo[3], ...numBodySeq]);
        }
        if ((flag & this.flagCode) > 0) {
            const [numInfo, numBodySeq] = numInfoSeq.shift();
            fp.code = FlexNum.intParse([numInfo[0], ...numBodySeq], numInfo[2]);
        }
        if ((flag & this.flagNumPath) > 0) {
            const [numInfo, numBodySeq] = numInfoSeq.shift();
            fp.numPath = FlexNum.non0LenParse([numInfo[3], ...numBodySeq]);
        }
        return fp;
    }
}

export class FlexNum {
    public static uintSerialize(unsigned: number): Uint8Array {
        return this.serialize(...this.uintPackHead(unsigned));
    }

    public static intSerialize(integer: number): Uint8Array {
        return this.serialize(...this.intPackHead(integer));
    }

    public static non0LenPackHead(unsigned: number): [number, number, number, number] {
        return this.uintPackHead(unsigned - 1);
    }

    private static uintPackHead(unsigned: number): [number, number, number, number] {
        const usize = Math.abs(unsigned);
        const bitsLen = Bit.len(usize);
        const [head, bytesLen] = this.packHead(usize, bitsLen);
        return [head, bytesLen, bitsLen, usize];
    }

    public static intPackHead(integer: number): [number, number, number, number] {
        let unsigned = 0;
        if (integer < 0) {
            unsigned = Math.abs(integer);
        }
        let bitsLen = Bit.len(unsigned);
        let [head, bytesLen] = FlexNum.packHead(unsigned, bitsLen);
        if (integer < 0) {
            let negative = 1;
            if (bytesLen < 7) {
                negative = 1 << (6 - bytesLen);
            }
            head |= negative;
        }
        return [head, bytesLen, bitsLen, unsigned];
    }

    private static packHead(unsigned: number, bitsLen: number): [number, number] {
        let bytesLen = Math.floor(bitsLen / 8);
        let headMaskShift = 8 - bytesLen;
        let headBits = 0;
        if (bytesLen > 5) {
            bytesLen = 8;
            headMaskShift = 2;
        } else if (bitsLen % 8 > 7 - bytesLen) {
            bytesLen++;
            headMaskShift--;
        } else {
            headBits |= unsigned >> (bytesLen * 8);
        }
        return [255 << headMaskShift & 255 | headBits, bytesLen];
    }

    private static serialize(head: number, bytesLen: number, bitsLen: number, u64: number): Uint8Array {
        let units = new Uint8Array(bytesLen + 1);
        units[0] = head;
        units.set(this.packBody(u64, bitsLen, bytesLen), 1);
        return units;
    }

    public static packBody(usize: number, bitsLen: number, bytesLen: number): Uint8Array {
        let units = new Uint8Array(bytesLen);
        for (let i = 0; i < bytesLen && i * 8 < bitsLen; i++) {
            units[bytesLen - i - 1] = usize >> (i * 8) & 255;
        }
        return units;
    }

    public static uintDeserialize(seq: number[]): number {
        [seq[0]] = this.parseHead(seq[0], false);
        return this.parse(seq);
    }

    public static intDeserialize(seq: number[]): number {
        const [headBits, _, negative] = this.parseHead(seq[0], true);
        seq[0] = headBits;
        return this.intParse(seq, negative);
    }

    public static parseHead(head: number, sign: boolean): [number, number, boolean, number] {
        let unsignedBits = 0;
        let bytesLen = 0;
        let negative = false;
        let originalBits = 0;
        for (let i = 0; i < 8; i++) {
            if ((128 >> i & head) === 0) {
                if ((bytesLen = i) > 5) {
                    bytesLen = 8;
                    originalBits = 1 & head;
                } else {
                    originalBits = 127 >> bytesLen & head;
                }
                break;
            }
        }
        unsignedBits = originalBits;
        if (sign) {
            if (bytesLen === 8) {
                negative = (1 & head) === 1;
            } else {
                let signShift = 0;
                if ((negative = (64 >> bytesLen & head) > 0)) {
                    signShift = 1;
                }
                unsignedBits = 127 >> bytesLen >> signShift & head;
            }
        }
        return [unsignedBits, bytesLen, negative, originalBits];
    }

    public static intParse(seq: number[], negative: boolean): number {
        const u64 = this.parse(seq);
        if (negative) {
            return -u64;
        }
        return u64;
    }

    public static non0LenParse(seq: number[]): number {
        return this.parse(seq) + 1;
    }

    private static parse(seq: number[]): number {
        let u64 = 0;
        for (let i = 0; i < seq.length; i++) {
            if (seq[i] > 0) {
                u64 |= seq[i] << ((seq.length - i - 1) * 8);
            }
        }
        return u64;
    }
}

class Bit {
    public static len(num: number): number {
        let len = 0;
        do {
            len++;
            num >>= 1;
        } while (num > 0)
        return len;
    }

    public static onesCount(num: number): number {
        let count = 0;
        for (let i = this.len(num) - 1; i >= 0; i--) {
            if ((1 << i & num) > 0) {
                count++;
            }
        }
        return count;
    }
}
