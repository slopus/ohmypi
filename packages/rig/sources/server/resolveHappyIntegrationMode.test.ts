import { describe, expect, it } from "vitest";

import { resolveHappyIntegrationMode } from "./resolveHappyIntegrationMode.js";

describe("resolveHappyIntegrationMode", () => {
    it.each([
        [undefined, true, "disabled"],
        ["disabled", true, "disabled"],
        ["enabled", false, "disabled"],
        ["enabled", true, "enabled"],
    ] as const)("resolves host %s and config %s to %s", (host, configured, expected) => {
        expect(resolveHappyIntegrationMode(host, configured, {})).toBe(expected);
    });

    it.each(["1", "true", "TRUE", "yes"])(
        "lets RIG_DISABLE_HAPPY_SYNC=%s override enabled config",
        (value) => {
            expect(
                resolveHappyIntegrationMode("enabled", true, {
                    RIG_DISABLE_HAPPY_SYNC: value,
                }),
            ).toBe("disabled");
        },
    );

    it("allows an explicit zero value to opt development back into Happy", () => {
        expect(resolveHappyIntegrationMode("enabled", true, { RIG_DISABLE_HAPPY_SYNC: "0" })).toBe(
            "enabled",
        );
    });
});
