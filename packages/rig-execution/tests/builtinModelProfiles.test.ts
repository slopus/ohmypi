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

    it("gives Opus 5 its own system prompt distinct from Opus 4.8", () => {
        const profiles = builtinModelProfiles("claude", "claude");
        const opus5 = profiles.find((candidate) => candidate.id === "anthropic/opus-5")?.prompt;
        const opus48 = profiles.find((candidate) => candidate.id === "anthropic/opus-4-8")?.prompt;

        expect(opus5).toContain("mid-conversation system turns");
        expect(opus48).not.toContain("mid-conversation system turns");
        expect(opus5).not.toBe(opus48);
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
