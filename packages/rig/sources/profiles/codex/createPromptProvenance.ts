import type { PromptProvenance } from "../impl/types.js";

export function createCodexPromptProvenance(clientTools: readonly string[]): PromptProvenance {
    return {
        client: "@openai/codex",
        version: "0.144.3",
        source: "codex-rs/models-manager/models.json at f93c18ed0f57151b410d25e8e1dff4408440560f",
        captureMethod: "Blocked main /responses inference request with Pragmatic personality",
        clientTools,
    };
}
