import type { ProfilePrompt, PromptProvenance } from "../impl/types.js";
import { readClaudeProfilePrompt } from "./readClaudeProfileArtifact.js";
import { renderClaudeSystemPrompt } from "./renderClaudeSystemPrompt.js";

export function createClaudeProfilePrompt(
    stem: string,
    provenance: PromptProvenance,
): ProfilePrompt {
    const text = readClaudeProfilePrompt(stem);
    return {
        original: {
            text,
            provenance,
            render: (context) => renderClaudeSystemPrompt(text, context),
        },
        patches: [],
        appends: [],
    };
}
