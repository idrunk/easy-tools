`use client`;

import { useToast } from "@/lib/ui/toast";
import { base64decode, base64encode } from "@protobuf-ts/runtime";
import { useEffect, useState } from "react";

export const encodeTypeTypical = 0;
export const encodeType1sComplement = 1;
export const productTypeLink = 16;
export const productTypeImage = 32;

export function encode(text: string, flag: number): string {
    let bytes = new TextEncoder().encode(text);
    if (flag > 0) {
        if (flag & encodeType1sComplement) bytes = bytes.map(v => ~v);
        const head = new Uint8Array(2 + bytes.length);
        head.set([0, flag], 0);
        head.set(bytes, 2);
        bytes = head;
    }
    return base64encode(bytes);
}

export function decode(encoded: string): [string, number] {
    let decoded = base64decode(encoded);
    const head = decoded[0] ?? 0;
    const flag = head === 0 ? decoded[1] ?? 0 : 0;
    if (head === 0 && flag > 0) {
        decoded = decoded.slice(2);
        if (flag & encodeType1sComplement) decoded = decoded.map(v => ~v);
    }
    return [new TextDecoder().decode(decoded), flag];
}

export default function Decoder({code}: {code?: string}) {
    const toast = useToast();
    const [rendered, setRendered] = useState('');
    useEffect(() => {
        if (!code && location?.hash) {
            code = location.hash.slice(1);
        }
        if (code) {
            try {
                const [decoded, flag] = decode(code);
                if (!(flag & productTypeImage)) setRendered(decoded);
            } catch (e) {
                toast(String(e));
            }
        }
    }, [code]);
    return <div className='border rounded p-1 pl-2 pr-2' contentEditable suppressContentEditableWarning onInput={(e) => e.preventDefault()}>{rendered}</div>;
}