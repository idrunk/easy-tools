import Relay from "./relay";

export default async function PreventSpiderCode({ searchParams }: { searchParams: Promise<{ [key: string]: string }> }) {
    const code = (await searchParams)['c'];
    if (code) {
        return <Relay code={code} />
    }
    return (
        <div>UI is coming soon ...</div>
    )
}