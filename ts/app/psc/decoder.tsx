`use client`;

import { base64decode } from "@protobuf-ts/runtime";

export default function Decoder({code}: {code: string}) {
    const decoded = new TextDecoder().decode(base64decode(code));
    return decoded;
}