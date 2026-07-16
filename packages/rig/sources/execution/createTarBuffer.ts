import tar from "tar-stream";

export async function createTarBuffer(
    name: string,
    content: string | Uint8Array,
    mode = 0o644,
): Promise<Buffer> {
    const pack = tar.pack();
    const chunks: Buffer[] = [];
    const complete = new Promise<Buffer>((resolve, reject) => {
        pack.on("data", (chunk: Buffer) => chunks.push(chunk));
        pack.once("error", reject);
        pack.once("end", () => resolve(Buffer.concat(chunks)));
    });
    pack.entry({ gid: 0, mode, name, type: "file", uid: 0 }, Buffer.from(content));
    pack.finalize();
    return complete;
}
