export function selectCodexFinalAnswerItems(
    responseItems: readonly string[] | undefined,
): readonly string[] {
    if (responseItems === undefined) return [];

    return responseItems.filter((serialized) => {
        try {
            const item: unknown = JSON.parse(serialized);
            return (
                typeof item === "object" &&
                item !== null &&
                Reflect.get(item, "type") === "message" &&
                Reflect.get(item, "role") === "assistant" &&
                Reflect.get(item, "phase") === "final_answer"
            );
        } catch {
            return false;
        }
    });
}
