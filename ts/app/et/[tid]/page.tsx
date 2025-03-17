import { headers } from "next/headers"
import Access from "./access"
import { PbTopic } from "@/lib/model/et/et.go"

export default async function ({ params }: { params: Promise<{ tid: string }> }) {
    let tid = (await params).tid;
    const headersStore = await headers();
    const status = Number(headersStore.get("auth-status") || 0);
    const topic = status > 0 ? undefined : PbTopic.create({
        id: headersStore.get("topic-id") || undefined,
        key: headersStore.get("topic-key") || undefined,
    });
    return <Access tid={tid} topic={topic} code={status} />;
}