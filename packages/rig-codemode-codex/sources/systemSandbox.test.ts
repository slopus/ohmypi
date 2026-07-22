import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { createServer } from "node:net";

import { expect, test } from "vitest";

import { createMacOsSandboxProfile } from "./createMacOsSandboxProfile.js";

const requiredExecutables = ["/usr/bin/sandbox-exec", "/bin/sh", "/usr/bin/nc"];
const macOsTest = test.runIf(
    process.platform === "darwin" &&
        requiredExecutables.every((executable) => {
            try {
                accessSync(executable, constants.X_OK);
                return true;
            } catch {
                return false;
            }
        }),
);

macOsTest("Seatbelt denies filesystem reads outside the runtime allowlist", () => {
    const result = spawnSync(
        "/usr/bin/sandbox-exec",
        [
            "-p",
            createMacOsSandboxProfile("/bin/sh"),
            "/bin/sh",
            "-c",
            "IFS= read -r line < /etc/passwd",
        ],
        { encoding: "utf8", timeout: 5_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBe(0);
});

macOsTest("Seatbelt denies TCP connections", async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    try {
        const address = server.address();
        if (address === null || typeof address === "string") {
            throw new Error("TCP test server did not expose a port.");
        }
        const result = spawnSync(
            "/usr/bin/sandbox-exec",
            [
                "-p",
                createMacOsSandboxProfile("/usr/bin/nc"),
                "/usr/bin/nc",
                "-z",
                "127.0.0.1",
                String(address.port),
            ],
            { encoding: "utf8", timeout: 5_000 },
        );

        expect(result.error).toBeUndefined();
        expect(result.status).not.toBeNull();
        expect(result.status).not.toBe(0);
    } finally {
        server.close();
    }
});
