export function applyCodexImageDetailsToPayload(
    payload: unknown,
    details: readonly ("high" | "original")[],
): unknown {
    if (typeof payload !== "object" || payload === null || !("input" in payload)) {
        return payload;
    }
    const input = (payload as { input?: unknown }).input;
    if (!Array.isArray(input)) {
        return payload;
    }

    let detailIndex = 0;
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
                block.type === "input_image"
            ) {
                const detail = details[detailIndex];
                detailIndex += 1;
                if (detail === "original") {
                    (block as { detail: string }).detail = "original";
                }
            }
        }
    }

    return payload;
}
