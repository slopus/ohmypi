import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { arch, hostname, release } from "node:os";
import { join } from "node:path";

import { KIMI_RIG_CLIENT_VERSION } from "./kimi-constants.js";

const fallbackDeviceIds = new Map<string, string>();

export function createKimiRequestHeaders(options: {
    env?: NodeJS.ProcessEnv;
    kimiHome: string;
}): Record<string, string> {
    const version = options.env?.RIG_KIMI_CLIENT_VERSION?.trim() || KIMI_RIG_CLIENT_VERSION;
    return {
        "User-Agent": `rig/${asciiHeader(version)}`,
        "X-Msh-Device-Id": kimiDeviceId(options.kimiHome),
        "X-Msh-Device-Model": asciiHeader(`${process.platform}-${arch()}`),
        "X-Msh-Device-Name": asciiHeader(hostname()),
        "X-Msh-Os-Version": asciiHeader(release()),
        "X-Msh-Platform": "kimi_code_cli",
        "X-Msh-Version": asciiHeader(version),
    };
}

function kimiDeviceId(kimiHome: string): string {
    try {
        const stored = readFileSync(join(kimiHome, "device_id"), "utf8").trim();
        if (stored.length > 0) return asciiHeader(stored);
    } catch {
        // Kimi Code creates this file during login; an in-memory id keeps custom auth files usable.
    }
    let fallback = fallbackDeviceIds.get(kimiHome);
    if (fallback === undefined) {
        fallback = randomUUID();
        fallbackDeviceIds.set(kimiHome, fallback);
    }
    return fallback;
}

function asciiHeader(value: string): string {
    return value.replace(/[^\x20-\x7E]/gu, "_");
}
