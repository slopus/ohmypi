import { describe, expect, it, vi } from "vitest";

import type { Message } from "../agent/types.js";
import { defineModel, defineProvider } from "../providers/types.js";
import { reviewAutoPermission } from "./reviewAutoPermission.js";

describe("reviewAutoPermission", () => {
    it("fails closed without inference when user authorization evidence is incomplete", async () => {
        const model = defineModel({
            id: "openai/gpt-test",
            name: "GPT Test",
            thinkingLevels: ["off"],
            defaultThinkingLevel: "off",
        });
        const stream = vi.fn(() => {
            throw new Error("The reviewer must not receive a partial user history.");
        });
        const provider = defineProvider({ id: "codex", models: [model], stream });
        const messages: Message[] = Array.from({ length: 7 }, (_, index) => ({
            role: "user",
            id: `user-${String(index)}`,
            blocks: [
                {
                    type: "text",
                    text: `USER_EVIDENCE_${String(index)} ${"e".repeat(10_000)}`,
                },
            ],
        }));

        await expect(
            reviewAutoPermission({
                args: { sandbox_permissions: "require_escalated" },
                messages,
                model,
                now: () => 0,
                provider,
                toolName: "exec_command",
            }),
        ).resolves.toEqual({
            decision: "ask",
            reason: "The full user authorization history did not fit in the automatic review.",
            risk: "medium",
            userAuthorization: "low",
        });
        expect(stream).not.toHaveBeenCalled();
    });
});
