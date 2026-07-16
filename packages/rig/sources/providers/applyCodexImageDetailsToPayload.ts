export function applyCodexImageDetailsToPayload(
    payload: unknown,
    originalImageUrls: ReadonlySet<string>,
): unknown {
    if (typeof payload !== "object" || payload === null || !("input" in payload)) {
        return payload;
    }
    const input = (payload as { input?: unknown }).input;
    if (!Array.isArray(input)) {
        return payload;
    }

    for (const item of input) {
        if (typeof item !== "object" || item === null) {
            continue;
        }
        const record = item as { content?: unknown; output?: unknown };
        const content = Array.isArray(record.content)
            ? record.content
            : Array.isArray(record.output)
              ? record.output
              : [];
        for (const block of content) {
            if (
                typeof block === "object" &&
                block !== null &&
                "type" in block &&
                block.type === "input_image" &&
                "image_url" in block &&
                typeof block.image_url === "string" &&
                originalImageUrls.has(block.image_url)
            ) {
                (block as { detail: string }).detail = "original";
            }
        }
    }

    return payload;
}
