import type { SessionMessage } from "@/core/SessionContext.js";

/** Adds fixed session messages unless the caller's rebuilt context already contains them. */
export function withInitialSessionMessages(
    initial: readonly SessionMessage[],
    rebuilt: readonly SessionMessage[],
): readonly SessionMessage[] {
    const includesInitial =
        rebuilt.length >= initial.length &&
        initial.every(
            (message, index) => JSON.stringify(message) === JSON.stringify(rebuilt[index]),
        );
    return includesInitial ? [...rebuilt] : [...initial, ...rebuilt];
}
