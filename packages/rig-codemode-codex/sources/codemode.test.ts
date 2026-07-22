import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { createCodeMode } from "./createCodeMode.js";
import { runCode } from "./runCode.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const binaryName =
    process.platform === "win32" ? "codex-code-mode-host.exe" : "codex-code-mode-host";
const binaryPath = path.join(packageRoot, "native", "target", "release", binaryName);
const nativeTest = test.runIf(existsSync(binaryPath));
const sandboxNativeTest = test.runIf(
    existsSync(binaryPath) && (process.platform === "darwin" || process.platform === "linux"),
);
const unixTest = test.runIf(process.platform !== "win32");

describe("Codex Code Mode process", () => {
    nativeTest("runs JavaScript through the public one-shot API", async () => {
        const result = await runCode("text(6 * 7);", { binaryPath });

        expect(result.state).toBe("result");
        expect(result.errorText).toBeUndefined();
        expect(result.text).toBe("42");
    });

    sandboxNativeTest("runs through a required system sandbox", async () => {
        const result = await runCode("text(6 * 7);", {
            binaryPath,
            sandbox: "required",
        });

        expect(result.text).toBe("42");
    });

    nativeTest("keeps state isolated inside a persistent session", async () => {
        const codeMode = await createCodeMode({ binaryPath });
        try {
            const session = await codeMode.createSession();
            await session.run('store("answer", { value: 42 });');

            const result = await session.run('text(load("answer").value);');

            expect(result.text).toBe("42");
        } finally {
            await codeMode.close();
        }
    });

    nativeTest("reserves explicit session IDs while opening", async () => {
        const codeMode = await createCodeMode({ binaryPath });
        try {
            const first = codeMode.createSession({ sessionId: "shared" });
            await expect(codeMode.createSession({ sessionId: "shared" })).rejects.toThrow(
                "already open",
            );
            await first;
        } finally {
            await codeMode.close();
        }
    });

    nativeTest("does not return a session after host closure starts", async () => {
        const codeMode = await createCodeMode({ binaryPath });
        const opening = codeMode.createSession({ sessionId: "closing" });
        const closing = codeMode.close();

        await expect(opening).rejects.toThrow();
        await closing;
    });

    nativeTest("delegates tools and notifications to Node", async () => {
        const notifications: string[] = [];
        const result = await runCode(
            `
const result = await tools.echo({ value: "hello" });
notify("working");
text(result.value);
`,
            {
                binaryPath,
                onNotification: ({ text }) => {
                    notifications.push(text);
                },
                tools: [
                    {
                        name: "echo",
                        execute(input) {
                            return input ?? null;
                        },
                    },
                ],
            },
        );

        expect(result.text).toBe("hello");
        expect(notifications).toEqual(["working"]);
    });

    nativeTest("returns a tool error for non-finite JSON output", async () => {
        const result = await runCode("await tools.invalid({});", {
            binaryPath,
            tools: [
                {
                    name: "invalid",
                    execute() {
                        return { nested: [Number.NaN] };
                    },
                },
            ],
        });

        expect(result.errorText).toContain("non-finite number");
    });

    nativeTest("waits through yielded execution", async () => {
        const result = await runCode(
            'await new Promise(resolve => setTimeout(resolve, 25)); text("done");',
            {
                binaryPath,
                yieldTimeMs: 1,
            },
        );

        expect(result.responses.some((response) => response.state === "yielded")).toBe(true);
        expect(result.state).toBe("result");
        expect(result.text).toBe("done");
    });

    nativeTest("terminates a yielded cell", async () => {
        const codeMode = await createCodeMode({ binaryPath });
        try {
            const session = await codeMode.createSession();
            const yielded = await session.execute(
                'await new Promise(resolve => setTimeout(resolve, 10_000)); text("late");',
                { yieldTimeMs: 1 },
            );

            expect(yielded.state).toBe("yielded");
            const terminated = await session.terminate(yielded.cellId);
            expect(terminated.state).toBe("terminated");
        } finally {
            await codeMode.close();
        }
    });

    nativeTest("rejects pre-aborted execute and wait operations locally", async () => {
        const codeMode = await createCodeMode({ binaryPath });
        try {
            const session = await codeMode.createSession();
            const controller = new AbortController();
            controller.abort(new Error("cancelled before dispatch"));

            await expect(
                session.execute("text(42);", { signal: controller.signal }),
            ).rejects.toThrow("cancelled before dispatch");
            await expect(session.wait("missing-cell", 1, controller.signal)).rejects.toThrow(
                "cancelled before dispatch",
            );
        } finally {
            await codeMode.close();
        }
    });

    nativeTest("returns JavaScript exceptions as execution data", async () => {
        const result = await runCode('throw new Error("broken");', { binaryPath });

        expect(result.state).toBe("result");
        expect(result.errorText).toContain("broken");
    });

    unixTest("rejects cleanly when the host exits during handshake", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "codemode-dead-host-"));
        const deadHost = path.join(directory, "dead-host");
        writeFileSync(deadHost, "#!/bin/sh\nexit 1\n");
        chmodSync(deadHost, 0o755);

        await expect(createCodeMode({ binaryPath: deadHost })).rejects.toThrow();
    });
});
