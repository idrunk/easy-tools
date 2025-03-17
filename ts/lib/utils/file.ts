'use client';

export async function readToLines(file: File): Promise<string[]> {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = e => {
            const text = e.target?.result as string || "";
            resolve(text.split(/\n/g));
        }
        reader.onerror = reject;
        reader.readAsText(file);
    })
}

export async function exportStream(stream: ReadableStream, filename: string): Promise<void> {
    const streamSaver = await import("streamsaver")
    const writer = streamSaver.createWriteStream(filename).getWriter();
    const reader = stream.getReader();
    while (true) {
        const {done, value} = await reader.read();
        if (done) {
            writer.close();
            break;
        }
        writer.write(value);
    }
}
