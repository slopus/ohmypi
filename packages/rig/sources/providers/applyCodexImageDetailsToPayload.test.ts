import { describe, expect, it } from "vitest";

import { applyCodexImageDetailsToPayload } from "./applyCodexImageDetailsToPayload.js";

describe("applyCodexImageDetailsToPayload", () => {
    it("matches original detail by image identity when serialization changes image order", () => {
        const payload = {
            input: [
                {
                    role: "user",
                    content: [{ type: "input_image", detail: "auto", image_url: "second" }],
                },
                {
                    type: "function_call_output",
                    output: [{ type: "input_image", detail: "auto", image_url: "first" }],
                },
            ],
        };

        expect(applyCodexImageDetailsToPayload(payload, new Set(["second"]))).toEqual({
            input: [
                {
                    role: "user",
                    content: [{ type: "input_image", detail: "original", image_url: "second" }],
                },
                {
                    type: "function_call_output",
                    output: [{ type: "input_image", detail: "auto", image_url: "first" }],
                },
            ],
        });
    });
});
