import type { TextBlock } from "../../../../types.js";

export function selectCodexFinalAnswerBlocks(
    responseItems: readonly string[] | undefined,
): readonly TextBlock[] {
    if (responseItems === undefined) return [];

    return responseItems.flatMap((serialized): readonly TextBlock[] => {
        let item: unknown;
        try {
            item = JSON.parse(serialized);
        } catch {
            return [];
        }
        if (
            typeof item !== "object" ||
            item === null ||
            Reflect.get(item, "type") !== "message" ||
            Reflect.get(item, "role") !== "assistant" ||
            Reflect.get(item, "phase") !== "final_answer"
        ) {
            return [];
        }

        const content = Reflect.get(item, "content");
        if (!Array.isArray(content)) return [];
        return content.flatMap((part): readonly TextBlock[] => {
            if (typeof part !== "object" || part === null) return [];
            const type = Reflect.get(part, "type");
            const text =
                type === "output_text"
                    ? Reflect.get(part, "text")
                    : type === "refusal"
                      ? Reflect.get(part, "refusal")
                      : undefined;
            return typeof text === "string" && text.length > 0 ? [{ type: "text", text }] : [];
        });
    });
}
