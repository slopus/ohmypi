export async function readBoundedResponseText(
    response: Response,
    maximumBytes: number,
): Promise<string> {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
        throw new Error(`Gemini response exceeded the ${String(maximumBytes)} byte size limit.`);
    }

    if (response.body === null) return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        while (true) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.byteLength;
            if (bytes > maximumBytes) {
                await reader.cancel();
                throw new Error(
                    `Gemini response exceeded the ${String(maximumBytes)} byte size limit.`,
                );
            }
            chunks.push(next.value);
        }
    } finally {
        reader.releaseLock();
    }

    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
}
