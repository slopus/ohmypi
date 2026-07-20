import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("Escape clears a draft before interrupting a delayed response", () => {
    it("clears the draft, restores queued input on the next Escape, and ignores stale output", async () => {
        const gym = await createGym({
            cols: 66,
            inference: [
                {
                    content: [{ text: "STALE_DELAYED_OUTPUT", type: "text" }],
                    delayMs: 10_000,
                },
                { content: [{ text: "RECOVERED_AFTER_INTERRUPT", type: "text" }] },
            ],
            rows: 20,
        });
        running.add(gym);
        const baseline = (await gym.terminal.snapshot()).scroll;

        gym.terminal.type("Begin a delayed response.");
        gym.terminal.press("enter");
        await gym.terminal.waitForText("esc to interrupt", 30_000);

        gym.terminal.type("queued prompt");
        await gym.terminal.waitForText("› queued prompt");
        gym.terminal.press("tab");
        const queued = await gym.terminal.waitForText("↳ queued queued prompt");
        expect(queued.text).toContain("queued 1");

        gym.terminal.type("draft tail");
        gym.terminal.press("escape");
        const cleared = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("Ask Rig to do anything") &&
                snapshot.text.includes("esc to interrupt") &&
                !snapshot.text.includes("draft tail"),
            "the first Escape to clear the draft while inference continues",
            30_000,
        );
        expect(cleared.text).not.toContain("Session interrupted");

        gym.terminal.press("escape");
        const restored = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("Session interrupted") &&
                snapshot.text.includes("queued prompt") &&
                !snapshot.text.includes("draft tail"),
            "interruption notice and restored queued input",
            30_000,
        );
        expect(restored.text).not.toContain("STALE_DELAYED_OUTPUT");
        expect(restored.scroll.atBottom).toBe(true);

        gym.terminal.press("enter");
        const recovered = await gym.terminal.waitForText("RECOVERED_AFTER_INTERRUPT", 30_000);
        expect(recovered.text).not.toContain("STALE_DELAYED_OUTPUT");
        expect(recovered.text.match(/Session interrupted/gu)).toHaveLength(1);
        expect(recovered.rows).toHaveLength(20);
        expect(recovered.text).toContain("gym off · /workspace");
        expect(recovered.scroll.atBottom).toBe(true);
        expect(recovered.scroll.bottomDepartureCount).toBe(baseline.bottomDepartureCount);
        expect(recovered.scroll.topArrivalCount).toBe(baseline.topArrivalCount);
        expect(lastUserText(agentRequests(gym).at(1)?.context.messages ?? [])).toBe(
            "queued prompt",
        );
    }, 120_000);
});

function agentRequests(gym: Gym) {
    return gym.inference.requests.filter(
        (request) => !request.options.sessionId?.endsWith(":title"),
    );
}

function lastUserText(messages: readonly { role: string; content: unknown }[]): string | undefined {
    const message = [...messages].reverse().find((candidate) => candidate.role === "user");
    if (typeof message?.content === "string") return message.content;
    if (!Array.isArray(message?.content)) return undefined;
    return message.content
        .filter(
            (block): block is { text: string; type: "text" } =>
                typeof block === "object" &&
                block !== null &&
                "type" in block &&
                block.type === "text" &&
                "text" in block &&
                typeof block.text === "string",
        )
        .map((block) => block.text)
        .join("");
}
