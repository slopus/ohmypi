import { describe, expect, it } from "vitest";

import { normalizeAutoPermissionReview } from "./normalizeAutoPermissionReview.js";

describe("normalizeAutoPermissionReview", () => {
    it.each([
        ["low", "low"],
        ["low", "medium"],
        ["medium", "low"],
        ["medium", "high"],
        ["high", "medium"],
        ["high", "high"],
    ] as const)("allows %s-risk work with %s authorization", (risk, userAuthorization) => {
        expect(
            normalizeAutoPermissionReview({
                decision: "allow",
                reason: "Allowed by policy.",
                risk,
                userAuthorization,
            }).decision,
        ).toBe("allow");
    });

    it("requires confirmation for high-risk work with weak authorization", () => {
        expect(
            normalizeAutoPermissionReview({
                decision: "allow",
                reason: "The action was not clearly requested.",
                risk: "high",
                userAuthorization: "low",
            }).decision,
        ).toBe("ask");
    });
});
