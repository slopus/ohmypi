import { describe, expect, it } from "vitest";

import { parseAutoPermissionReview } from "./parseAutoPermissionReview.js";

describe("parseAutoPermissionReview", () => {
    it("parses a fenced structured review", () => {
        expect(
            parseAutoPermissionReview(
                '```json\n{"decision":"allow","risk":"low","reason":"Runs local tests."}\n```',
            ),
        ).toEqual({ decision: "allow", risk: "low", reason: "Runs local tests." });
    });

    it("rejects incomplete or unknown decisions", () => {
        expect(parseAutoPermissionReview('{"decision":"allow","risk":"low"}')).toBeUndefined();
        expect(
            parseAutoPermissionReview(
                '{"decision":"deny","risk":"high","reason":"Not supported."}',
            ),
        ).toBeUndefined();
    });
});
