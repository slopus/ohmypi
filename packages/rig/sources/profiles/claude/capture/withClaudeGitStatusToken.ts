const token = "$CLAUDE_RUNTIME_GIT_STATUS";

export function withClaudeGitStatusToken(system: unknown): unknown {
    if (typeof system === "string") return system.includes(token) ? system : `${system}${token}`;
    if (!Array.isArray(system)) {
        if (
            typeof system === "object" &&
            system !== null &&
            "text" in system &&
            typeof system.text === "string"
        ) {
            return {
                ...system,
                text: system.text.includes(token) ? system.text : `${system.text}${token}`,
            };
        }
        return system;
    }

    const result = [...system];
    for (let index = result.length - 1; index >= 0; index -= 1) {
        const block = result[index];
        if (typeof block === "string") {
            result[index] = block.includes(token) ? block : `${block}${token}`;
            return result;
        }
        if (
            typeof block === "object" &&
            block !== null &&
            "text" in block &&
            typeof block.text === "string"
        ) {
            result[index] = {
                ...block,
                text: block.text.includes(token) ? block.text : `${block.text}${token}`,
            };
            return result;
        }
    }
    return system;
}
