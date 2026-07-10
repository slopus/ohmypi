import { describe, expect, it } from "vitest";

import type { Message } from "./types.js";
import { replaceLastTurnToolResultImages } from "./replaceLastTurnToolResultImages.js";

describe("replaceLastTurnToolResultImages", () => {
    it("replaces images only in the latest tool output and preserves its text", () => {
        const messages = transcriptWithTwoImageResults();

        const replacements = replaceLastTurnToolResultImages(messages, "Invalid image");

        expect(replacements).toHaveLength(1);
        expect(messages[1]).toMatchObject({
            blocks: [{ rendered: [{ type: "image", data: "older" }] }],
        });
        expect(messages[2]).toMatchObject({
            blocks: [
                {
                    display: "Invalid image",
                    isError: false,
                    rendered: [
                        { type: "text", text: "metadata" },
                        { type: "text", text: "Invalid image" },
                    ],
                },
            ],
        });
    });

    it("does not reach past a newer text-only tool output", () => {
        const messages = transcriptWithTwoImageResults();
        messages.push({
            role: "agent",
            id: "latest-text",
            blocks: [
                {
                    type: "tool_result",
                    toolCallId: "call-3",
                    toolName: "read",
                    rendered: [{ type: "text", text: "ok" }],
                    display: "Read file",
                },
            ],
        });

        expect(replaceLastTurnToolResultImages(messages, "Invalid image")).toEqual([]);
        expect(messages[2]).toMatchObject({
            blocks: [
                {
                    rendered: [
                        { type: "text", text: "metadata" },
                        { type: "image", mediaType: "image/png", data: "newer" },
                    ],
                },
            ],
        });
    });
});

function transcriptWithTwoImageResults(): Message[] {
    return [
        {
            role: "user",
            id: "user-1",
            blocks: [{ type: "text", text: "Inspect images" }],
        },
        {
            role: "agent",
            id: "older-result",
            blocks: [
                {
                    type: "tool_result",
                    toolCallId: "call-1",
                    toolName: "view_image",
                    rendered: [{ type: "image", mediaType: "image/png", data: "older" }],
                    display: "Viewed older image",
                },
            ],
        },
        {
            role: "agent",
            id: "newer-result",
            blocks: [
                {
                    type: "tool_result",
                    toolCallId: "call-2",
                    toolName: "view_image",
                    rendered: [
                        { type: "text", text: "metadata" },
                        { type: "image", mediaType: "image/png", data: "newer" },
                    ],
                    display: "Viewed newer image",
                    isError: false,
                },
            ],
        },
    ];
}
