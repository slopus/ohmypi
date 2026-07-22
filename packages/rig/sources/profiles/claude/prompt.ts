import type { PromptProvenance } from "../impl/types.js";
import { createClaudeProfilePrompt } from "./createClaudeProfilePrompt.js";
import { readClaudeGoldenTools } from "./readClaudeProfileArtifact.js";

function createClaudeSource(stem: string): PromptProvenance {
    return {
        client: "Claude Code through Claude Agent SDK",
        version: "Claude Code 2.1.201 / @anthropic-ai/claude-agent-sdk 0.3.201",
        source: `${stem}.capture.json; official prompt and tools are the adjacent golden files`,
        captureMethod:
            "Official full claude_code system/tool presets intercepted by a blocking HTTP MITM proxy; dynamic values are tokenized and rendered by Rig",
        clientTools: readClaudeGoldenTools(stem).map((tool) => tool.name),
    };
}

export const claudeFable5Prompt = createClaudeProfilePrompt(
    "claude-fable-5",
    createClaudeSource("claude-fable-5"),
);
export const claudeOpus48Prompt = createClaudeProfilePrompt(
    "claude-opus-4-8",
    createClaudeSource("claude-opus-4-8"),
);
export const claudeSonnet5Prompt = createClaudeProfilePrompt(
    "claude-sonnet-5",
    createClaudeSource("claude-sonnet-5"),
);
