import { describe, expect, it, vi } from "vitest";

import type { BashContext, BashSessionSnapshot } from "../../agent/index.js";
import { readSessionWithProgress } from "./readSessionWithProgress.js";

describe("readSessionWithProgress", () => {
    it("keeps a bounded live-output prefix stable after the output exceeds its display limit", async () => {
        const head = `TELEPROMPTER_HEAD_${"a".repeat(1_900)}`;
        const tail = `TELEPROMPTER_TAIL_${"z".repeat(500)}`;
        const laterTail = `LATER_TAIL_${"x".repeat(500)}`;
        const snapshots = [
            snapshot({ status: "running", stdout: head, stdoutDelta: head }),
            snapshot({ status: "running", stdout: head + tail, stdoutDelta: tail }),
            snapshot({
                status: "running",
                stdout: head + tail + laterTail,
                stdoutDelta: laterTail,
            }),
            snapshot({ status: "completed", stdout: head + tail + laterTail }),
        ];
        const readSession = vi.fn(async () => snapshots.shift());
        const onProgress = vi.fn();

        const result = await readSessionWithProgress({
            bash: { readSession } as unknown as BashContext,
            onProgress,
            sessionId: 1,
        });

        expect(result?.stdoutDelta).toBe(head + tail + laterTail);
        expect(onProgress).toHaveBeenCalledTimes(2);
        const displays = onProgress.mock.calls.map(([display]) => display as string);
        expect(displays[0]).toBe(head);
        expect(displays[1]).toHaveLength(2_000);
        expect(displays[1]).toMatch(/^TELEPROMPTER_HEAD_/u);
        expect(displays[1]).not.toContain("LATER_TAIL_");
    });
});

function snapshot(
    overrides: Partial<BashSessionSnapshot> & Pick<BashSessionSnapshot, "status" | "stdout">,
): BashSessionSnapshot {
    return {
        command: "stream output",
        cwd: "/workspace",
        exitCode: overrides.status === "completed" ? 0 : null,
        sessionId: 1,
        stderr: "",
        stderrDelta: "",
        stdoutDelta: "",
        timedOut: false,
        ...overrides,
    };
}
