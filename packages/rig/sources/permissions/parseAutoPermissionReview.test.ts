import { describe, expect, it } from "vitest";

import { parseAutoPermissionReview } from "./parseAutoPermissionReview.js";

describe("parseAutoPermissionReview", () => {
    it("parses a fenced structured review", () => {
        expect(
            parseAutoPermissionReview(
                '```json\n{"decision":"allow","risk":"low","user_authorization":"high","reason":"Runs local tests."}\n```',
            ),
        ).toEqual({
            decision: "allow",
            risk: "low",
            userAuthorization: "high",
            reason: "Runs local tests.",
        });
    });

    it("rejects incomplete or unknown decisions", () => {
        expect(
            parseAutoPermissionReview(
                '{"decision":"allow","risk":"low","user_authorization":"high"}',
            ),
        ).toBeUndefined();
        expect(
            parseAutoPermissionReview(
                '{"decision":"deny","risk":"high","user_authorization":"low","reason":"Not supported."}',
            ),
        ).toBeUndefined();
    });
});
