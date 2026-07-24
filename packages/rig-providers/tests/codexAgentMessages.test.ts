import { describe, expect, it } from "vitest";

import { toOpenAIResponseInput } from "@/responses/toOpenAIResponseInput.js";

describe("Codex agent messages", () => {
    it("serializes an encrypted collaboration task as a native agent_message", () => {
        expect(
            toOpenAIResponseInput({
                instructions: "",
                messages: [
                    {
                        role: "agent",
                        author: "/root",
                        recipient: "/root/rigstate_impl",
                        header: "Message Type: NEW_TASK\nTask name: /root/rigstate_impl\nSender: /root\nPayload:\n",
                        encryptedContent: "opaque-encrypted-task",
                    },
                ],
            }),
        ).toEqual([
            {
                type: "agent_message",
                author: "/root",
                recipient: "/root/rigstate_impl",
                content: [
                    {
                        type: "input_text",
                        text: "Message Type: NEW_TASK\nTask name: /root/rigstate_impl\nSender: /root\nPayload:\n",
                    },
                    {
                        type: "encrypted_content",
                        encrypted_content: "opaque-encrypted-task",
                    },
                ],
            },
        ]);
    });
});
