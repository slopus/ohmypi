import { describe, expect, it } from "vitest";

import { applyCodexImageDetailsToPayload } from "./applyCodexImageDetailsToPayload.js";

describe("applyCodexImageDetailsToPayload", () => {
    it("applies original detail to matching image positions across message types", () => {
        const payload = {
            input: [
                {
                    role: "user",
                    content: [{ type: "input_image", detail: "auto", image_url: "first" }],
                },
                {
                    type: "function_call_output",
                    output: [{ type: "input_image", detail: "auto", image_url: "second" }],
                },
            ],
        };

        expect(applyCodexImageDetailsToPayload(payload, ["high", "original"])).toEqual({
            input: [
                {
                    role: "user",
                    content: [{ type: "input_image", detail: "auto", image_url: "first" }],
                },
                {
                    type: "function_call_output",
                    output: [{ type: "input_image", detail: "original", image_url: "second" }],
                },
            ],
        });
    });
});
