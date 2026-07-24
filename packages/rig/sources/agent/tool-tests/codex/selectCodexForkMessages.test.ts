import { describe, expect, it } from "vitest";

import type { Message } from "../../types.js";
import { selectCodexForkMessages } from "../../tools/codex/v2/impl/selectCodexForkMessages.js";

describe("selectCodexForkMessages", () => {
    it("keeps human turns and final answers without leaking tool or agent traffic", () => {
        const messages: Message[] = [
            { role: "user", id: "u1", blocks: [{ type: "text", text: "human task" }] },
            {
                role: "agent",
                id: "thinking",
                blocks: [
                    { type: "thinking", thinking: "private reasoning" },
                    { type: "text", text: "Checking. final answer" },
                ],
                responseItems: [
                    '{"type":"reasoning","encrypted_content":"secret"}',
                    '{"type":"message","role":"assistant","phase":"commentary","content":[{"type":"output_text","text":"Checking. "}]}',
                    '{"type":"message","role":"assistant","phase":"final_answer","content":[{"type":"output_text","text":"final answer"}]}',
                ],
            },
            {
                role: "agent",
                id: "call",
                blocks: [
                    {
                        type: "tool_call",
                        id: "call-1",
                        name: "exec_command",
                        arguments: {},
                    },
                ],
                responseItems: [
                    '{"type":"function_call","call_id":"call-1","name":"exec_command","arguments":"{}"}',
                ],
            },
            {
                role: "user",
                id: "agent-message",
                provenance: "agent",
                blocks: [{ type: "text", text: "internal delegation" }],
            },
        ];

        const forked = selectCodexForkMessages(messages, undefined);
        expect(forked).toEqual([
            messages[0],
            {
                role: "agent",
                id: "thinking",
                blocks: [{ type: "text", text: "final answer" }],
                responseItems: [
                    '{"type":"message","role":"assistant","phase":"final_answer","content":[{"type":"output_text","text":"final answer"}]}',
                ],
            },
        ]);
        expect(selectCodexForkMessages(forked, undefined)).toEqual(forked);
    });

    it("drops assistant text when no phase-bearing final answer is available", () => {
        const messages: Message[] = [
            { role: "user", id: "u1", blocks: [{ type: "text", text: "human task" }] },
            {
                role: "agent",
                id: "legacy",
                blocks: [{ type: "text", text: "unclassified assistant text" }],
            },
            {
                role: "agent",
                id: "commentary",
                blocks: [{ type: "text", text: "Checking." }],
                responseItems: [
                    '{"type":"message","role":"assistant","phase":"commentary","content":[{"type":"output_text","text":"Checking."}]}',
                ],
            },
        ];

        expect(selectCodexForkMessages(messages, undefined)).toEqual([messages[0]]);
    });

    it("counts triggering agent traffic but not queued messages toward a last-turn fork", () => {
        const messages: Message[] = [
            { role: "user", id: "u1", blocks: [{ type: "text", text: "older human turn" }] },
            {
                role: "user",
                id: "internal",
                provenance: "agent",
                agentMessageTriggerTurn: true,
                blocks: [{ type: "text", text: "internal delegation" }],
            },
            {
                role: "user",
                id: "queued",
                provenance: "agent",
                blocks: [{ type: "text", text: "queued message" }],
            },
            { role: "user", id: "u2", blocks: [{ type: "text", text: "latest human turn" }] },
        ];

        expect(selectCodexForkMessages(messages, 2)).toEqual([messages[3]]);
    });
});
