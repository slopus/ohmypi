import type { Usage } from "@slopus/rig-execution";

import type { SessionTokenCount } from "../protocol/index.js";

type SessionTokenCountUpdate =
    | { type: "compaction"; contextTokens: number }
    | { type: "reset" }
    | { type: "usage"; usage: Usage };

const ZERO_SESSION_TOKEN_COUNT: SessionTokenCount = {
    lastContextTokens: 0,
    totalTokens: 0,
};

export function updateSessionTokenCount(
    current: SessionTokenCount | undefined,
    update: SessionTokenCountUpdate,
): SessionTokenCount {
    if (update.type === "reset") return ZERO_SESSION_TOKEN_COUNT;

    const previous = current ?? ZERO_SESSION_TOKEN_COUNT;
    const contextTokens =
        update.type === "compaction"
            ? Math.max(0, update.contextTokens)
            : Math.max(0, update.usage.input) +
              Math.max(0, update.usage.cacheRead) +
              Math.max(0, update.usage.cacheWrite) +
              Math.max(0, update.usage.output);

    return {
        lastContextTokens: contextTokens,
        totalTokens:
            previous.totalTokens +
            (update.type === "compaction"
                ? contextTokens
                : Math.max(0, contextTokens - previous.lastContextTokens)),
    };
}
