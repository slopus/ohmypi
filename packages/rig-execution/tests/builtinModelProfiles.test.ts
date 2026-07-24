import { describe, expect, it } from "vitest";

import { builtinModelProfiles } from "@/builtinModelProfiles.js";

describe("builtinModelProfiles", () => {
    it("exposes Opus 5 with the current Claude capabilities", () => {
        const profile = builtinModelProfiles("claude", "claude").find(
            (candidate) => candidate.id === "anthropic/opus-5",
        );

        expect(profile).toMatchObject({
            contextWindow: 1_000_000,
            defaultEffort: "medium",
            model: {
                autoCompactWindow: 200_000,
                id: "anthropic/opus-5",
                name: "Opus 5 1M",
                thinkingLevels: ["off", "low", "medium", "high", "xhigh", "max", "ultra"],
            },
            name: "Opus 5 1M",
            providerId: "claude",
            providerType: "claude",
        });
    });

    it("preserves each Grok model's supported default effort", () => {
        const profiles = builtinModelProfiles("grok", "grok");

        expect(
            profiles.find((profile) => profile.id === "xai/grok-composer-2.5-fast")?.defaultEffort,
        ).toBe("off");
        expect(profiles.find((profile) => profile.id === "xai/grok-4.5")?.defaultEffort).toBe(
            "high",
        );
        expect(
            profiles.find((profile) => profile.id === "xai/grok-build")?.defaultEffort,
        ).toBeUndefined();
    });
});
