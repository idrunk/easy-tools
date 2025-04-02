import { Metadata } from "next";
import PSCLogo from "@/img/prevent-spider-100.png";
import Setup from "./setup";
import { ModuleMeta } from "../module-layout";

export const metadata: Metadata & ModuleMeta = {
    title: '反蛛码',
    description: '编解码敏感内容，防止被蜘蛛爬取采集',
    keywords: ["点对点", "p2p", "文件传输", "局域网传输", "反蜘蛛编码"],
    link: '/psc',
    logo: PSCLogo,
    className: 'max-w-screen-lg',
};

export default async function PreventSpiderCode({ searchParams }: { searchParams: Promise<{ [key: string]: string }> }) {
    const code = (await searchParams)['c'];
    return <Setup meta={metadata} code={code} />
}