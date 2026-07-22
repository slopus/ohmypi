import type { TSchema } from "@sinclair/typebox";

export interface ClaudeToolDefinition {
    name: string;
    description: string;
    input_schema: TSchema;
}

export interface ClaudeProfileArtifactDescriptor {
    stem: "claude-fable-5" | "claude-opus-4-8" | "claude-sonnet-5";
    model: string;
    identity: string;
    memoryHeading: "# Memory" | "# auto memory";
}

export const CLAUDE_PROFILE_ARTIFACTS: readonly ClaudeProfileArtifactDescriptor[] = [
    {
        stem: "claude-fable-5",
        model: "claude-fable-5[1m]",
        identity:
            "You are Rig, a coding agent powered by Claude Fable 5. You operate through Rig's tools, permissions, and runtime.",
        memoryHeading: "# Memory",
    },
    {
        stem: "claude-opus-4-8",
        model: "opus[1m]",
        identity:
            "You are Rig, a coding agent powered by Claude Opus 4.8. You operate through Rig's tools, permissions, and runtime.",
        memoryHeading: "# Memory",
    },
    {
        stem: "claude-sonnet-5",
        model: "sonnet[1m]",
        identity:
            "You are Rig, a coding agent powered by Claude Sonnet 5. You operate through Rig's tools, permissions, and runtime.",
        memoryHeading: "# auto memory",
    },
];
