import { describe, expect, it } from "vitest";

import { classifyCodexErrorCode } from "./classifyCodexErrorCode.js";

describe("classifyCodexErrorCode", () => {
    it("classifies the structured Codex invalid-image response", () => {
        expect(
            classifyCodexErrorCode(`Codex error:
{"type":"error","error":{"type":"invalid_request_error","code":"invalid_value","message":"The image data you provided does not represent a valid image.","param":"input"},"status":400}`),
        ).toBe("invalid_image_request");
    });

    it("does not classify unrelated bad requests", () => {
        expect(classifyCodexErrorCode("Invalid tool schema in input.")).toBeUndefined();
    });
});
