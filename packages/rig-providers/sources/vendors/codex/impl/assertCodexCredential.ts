import type { CodexCredential } from "@/vendors/VendorCredential.js";

export function assertCodexCredential(value: unknown): asserts value is CodexCredential {
    if (
        typeof value === "object" &&
        value !== null &&
        "name" in value &&
        ((value as { name: unknown }).name === "codex-api-key" ||
            (value as { name: unknown }).name === "codex-session")
    )
        return;
    throw new Error("CodexProvider requires a codex-api-key or codex-session credential.");
}
