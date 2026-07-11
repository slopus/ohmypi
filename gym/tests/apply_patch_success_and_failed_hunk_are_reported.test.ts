import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "../../packages/gym/sources/index.js";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("apply_patch success and failed hunk are reported", () => {
    it("preserves exact tool-result flow, filesystem state, and terminal usability", async () => {
        const successfulPatch = [
            "*** Begin Patch",
            "*** Add File: patched.txt",
            "+created by the real patch tool",
            "+second line",
            "*** End Patch",
        ].join("\n");
        const failedPatch = [
            "*** Begin Patch",
            "*** Update File: seed.txt",
            "@@",
            "-this context is not present",
            "+this change must not be written",
            "*** End Patch",
        ].join("\n");
        const successfulResult = "Success. Updated the following files:\nA patched.txt";
        const failedResult =
            "Tool 'apply_patch' failed: Invalid patch: hunk did not match seed.txt";
        const gym = await createGym({
            cols: 92,
            files: { "seed.txt": "original seed\n" },
            inference(request, callIndex) {
                const lastMessage = request.context.messages.at(-1);
                const resultText =
                    typeof lastMessage?.content === "string"
                        ? lastMessage.content
                        : (lastMessage?.content ?? [])
                              .filter((block) => block.type === "text")
                              .map((block) => block.text)
                              .join("");

                if (callIndex === 0) {
                    return {
                        content: [
                            {
                                arguments: { patch: successfulPatch, workdir: "/workspace" },
                                id: "apply-successful-patch",
                                name: "apply_patch",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                if (callIndex === 1) {
                    expect(lastMessage).toMatchObject({
                        content: [{ text: successfulResult, type: "text" }],
                        isError: false,
                        role: "toolResult",
                        toolName: "apply_patch",
                    });
                    expect(resultText).toBe(successfulResult);
                    return {
                        content: [
                            {
                                arguments: { patch: failedPatch, workdir: "/workspace" },
                                id: "apply-failed-patch",
                                name: "apply_patch",
                                type: "toolCall",
                            },
                        ],
                        delayMs: 1_000,
                    };
                }

                if (callIndex === 2) {
                    expect(lastMessage).toMatchObject({
                        content: [{ text: failedResult, type: "text" }],
                        isError: true,
                        role: "toolResult",
                        toolName: "apply_patch",
                    });
                    expect(resultText).toBe(failedResult);
                    return {
                        content: [{ text: "PATCH_FLOW_COMPLETE", type: "text" }],
                        delayMs: 1_000,
                    };
                }

                expect(callIndex).toBe(3);
                expect(lastMessage).toMatchObject({ role: "user" });
                expect(resultText).toContain("Verify another turn after both patch results.");
                return {
                    content: [{ text: "PATCH_FOLLOW_UP_ACCEPTED", type: "text" }],
                };
            },
            rows: 24,
        });
        running.add(gym);
        const baseline = (await gym.terminal.snapshot()).scroll;

        gym.terminal.type("Apply one valid patch, then demonstrate a failed patch safely.");
        gym.terminal.press("enter");

        const applied = await gym.terminal.waitUntil(
            (snapshot) => snapshot.text.includes("Applied patch") && snapshot.scroll.atBottom,
            "human-readable successful patch result",
            30_000,
        );
        expect(applied.text).toContain("└ Applied patch");
        expect(applied.scroll.bottomDepartureCount).toBe(baseline.bottomDepartureCount);
        expect(applied.scroll.topArrivalCount).toBe(baseline.topArrivalCount);
        await expect(gym.readFile("patched.txt")).resolves.toBe(
            "created by the real patch tool\nsecond line",
        );

        const rejected = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("Invalid patch: hunk did not match seed.txt") &&
                snapshot.scroll.atBottom,
            "human-readable failed patch result",
            30_000,
        );
        expect(rejected.text).toContain("hunk did not match seed.txt");
        expect(rejected.scroll.bottomDepartureCount).toBe(baseline.bottomDepartureCount);
        expect(rejected.scroll.topArrivalCount).toBe(baseline.topArrivalCount);
        await expect(gym.readFile("seed.txt")).resolves.toBe("original seed\n");
        await expect(gym.readFile("patched.txt")).resolves.toBe(
            "created by the real patch tool\nsecond line",
        );

        const completed = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("PATCH_FLOW_COMPLETE") &&
                snapshot.text.includes("Ask Rig to do anything") &&
                snapshot.scroll.atBottom,
            "patch flow completion and idle composer",
            30_000,
        );
        expect(completed.rows).toHaveLength(24);
        expect(completed.scroll.visibleRows).toBe(24);
        expect(completed.scroll.bottomDepartureCount).toBe(baseline.bottomDepartureCount);
        expect(completed.scroll.topArrivalCount).toBe(baseline.topArrivalCount);
        expect(completed.text).toContain("Gym Off • /workspace");
        expect(completed.text).not.toContain("�");
        expect(completed.cursor.x).toBeLessThan(92);
        expect(completed.cursor.y).toBeLessThan(24);

        gym.terminal.type("Verify another turn after both patch results.");
        gym.terminal.press("enter");
        const followUp = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("PATCH_FOLLOW_UP_ACCEPTED") &&
                snapshot.text.includes("Ask Rig to do anything") &&
                snapshot.scroll.atBottom,
            "follow-up turn after successful and failed patches",
            30_000,
        );
        expect(followUp.scroll.bottomDepartureCount).toBe(baseline.bottomDepartureCount);
        expect(followUp.scroll.topArrivalCount).toBe(baseline.topArrivalCount);
        expect(followUp.text).toContain("Gym Off • /workspace");
        expect(followUp.text).not.toContain("�");

        const agentRequests = gym.inference.requests.filter(
            (request) => !request.options.sessionId?.endsWith(":title"),
        );
        expect(agentRequests).toHaveLength(4);
        expect(agentRequests[1]?.context.messages.at(-1)).toMatchObject({
            content: [{ text: successfulResult, type: "text" }],
            isError: false,
            role: "toolResult",
            toolName: "apply_patch",
        });
        expect(agentRequests[2]?.context.messages.at(-1)).toMatchObject({
            content: [{ text: failedResult, type: "text" }],
            isError: true,
            role: "toolResult",
            toolName: "apply_patch",
        });
        expect(applied.text).toContain("Edited Apply patch");
        expect(rejected.text).toContain("Failed Apply patch");
    }, 120_000);
});
