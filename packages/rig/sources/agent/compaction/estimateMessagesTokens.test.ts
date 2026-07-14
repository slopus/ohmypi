import { describe, expect, it } from "vitest";

import { estimateMessagesTokens } from "./estimateMessagesTokens.js";
import type { Message } from "../types.js";

describe("estimateMessagesTokens", () => {
    it("counts encrypted reasoning carried back to the provider", () => {
        const withoutEncrypted: Message[] = [
            {
                role: "agent",
                id: "agent-1",
                blocks: [{ type: "thinking", thinking: "visible" }],
            },
        ];
        const withEncrypted: Message[] = [
            {
                role: "agent",
                id: "agent-1",
                blocks: [
                    {
                        type: "thinking",
                        thinking: "visible",
                        encrypted: "x".repeat(400),
                    },
                ],
            },
        ];

        expect(estimateMessagesTokens(withEncrypted)).toBe(
            estimateMessagesTokens(withoutEncrypted) + 100,
        );
    });
});
