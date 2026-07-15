import { PassThrough, Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import type { SessionSummary } from "../protocol/index.js";
import { selectSession } from "./selectSession.js";

describe("selectSession", () => {
    it("shows a one-line recap and returns the selected session", async () => {
        const input = new PassThrough() as PassThrough & { isTTY: boolean };
        input.isTTY = true;
        input.end("1\n");
        let outputText = "";
        const output = new Writable({
            write(chunk, _encoding, callback) {
                outputText += String(chunk);
                callback();
            },
        });

        await expect(
            selectSession(
                [
                    sessionSummary({
                        recap: "Implemented delayed metadata.\nThe tests pass.\u001b[31m",
                        title: "Delayed session metadata",
                    }),
                ],
                { input, output },
            ),
        ).resolves.toBe("session-1");

        expect(outputText).toContain("1. Delayed session metadata");
        expect(outputText).toContain("Implemented delayed metadata. The tests pass.");
        expect(outputText).not.toContain("\nThe tests pass");
        expect(outputText).not.toContain("\u001b");
    });
});

function sessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
    return {
        createdAt: 1_700_000_000_000,
        cwd: "/tmp/rig-resume-picker-test",
        id: "session-1",
        lastMessageAt: 1_700_000_000_000,
        modelId: "openai/gpt-5.5",
        permissionMode: "workspace_write",
        providerId: "codex",
        status: "completed",
        titleStatus: "ready",
        updatedAt: 1_700_000_001_000,
        ...overrides,
    };
}
