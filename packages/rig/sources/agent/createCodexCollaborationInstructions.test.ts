import { describe, expect, it } from "vitest";

import { createCodexCollaborationInstructions } from "./createCodexCollaborationInstructions.js";

describe("createCodexCollaborationInstructions", () => {
    it("defaults root agents to explicit-request-only delegation", () => {
        const instructions = createCodexCollaborationInstructions({
            canSpawn: true,
            depth: 0,
            effort: "high",
            maxActive: 4,
        });

        expect(instructions).toContain("You are `/root`");
        expect(instructions).toContain("Do not spawn sub-agents unless the user");
        expect(instructions).toContain("4 available concurrency slots");
        expect(instructions).toContain(
            'Full-history forks (`fork_turns` omitted or `"all"`) inherit the parent model',
        );
    });

    it("gives child agents their parent handoff role", () => {
        const instructions = createCodexCollaborationInstructions({
            canSpawn: true,
            depth: 1,
            effort: "ultra",
            maxActive: 4,
        });

        expect(instructions).toContain("immediately delivered back to your parent agent");
        expect(instructions).toContain("Proactive multi-agent delegation is active");
        expect(instructions).toContain("cannot be called from inside `functions.exec`");
    });

    it("does not advertise spawning when the tool is unavailable", () => {
        const instructions = createCodexCollaborationInstructions({
            canSpawn: false,
            depth: 3,
            effort: "high",
            maxActive: 4,
        });

        expect(instructions).toContain("cannot spawn additional sub-agents at this depth");
        expect(instructions).toContain("immediately delivered back to your parent agent");
        expect(instructions).not.toContain("`spawn_agent`");
        expect(instructions).not.toContain("Full-history forks");
    });
});
