import type { ModelProfile } from "./types.js";

const commonRequest = {
    applyPatchToolType: "freeform",
    defaultReasoningSummary: "none",
    defaultVerbosity: "low",
    inputModalities: ["text", "image"],
    parallelToolCalls: true,
    reasoningSummaryFormat: "experimental",
    supportsOriginalImageDetail: true,
    truncation: { limit: 10_000, mode: "tokens" },
    webSearchToolType: "text_and_image",
} as const;

const references = {
    "openai/gpt-5.6-luna": {
        contextWindow: 372_000,
        defaultThinkingLevel: "medium",
        thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
        request: {
            ...commonRequest,
            compactionHash: "3000",
            maxContextWindow: 372_000,
            multiAgentVersion: "v1",
            toolMode: "code_mode_only",
            useResponsesLite: true,
        },
    },
    "openai/gpt-5.6-sol": {
        contextWindow: 372_000,
        defaultThinkingLevel: "low",
        thinkingLevels: ["low", "medium", "high", "xhigh", "max", "ultra"],
        request: {
            ...commonRequest,
            compactionHash: "3000",
            maxContextWindow: 372_000,
            multiAgentVersion: "v2",
            toolMode: "code_mode_only",
            useResponsesLite: true,
        },
    },
    "openai/gpt-5.6-terra": {
        contextWindow: 372_000,
        defaultThinkingLevel: "medium",
        thinkingLevels: ["low", "medium", "high", "xhigh", "max", "ultra"],
        request: {
            ...commonRequest,
            compactionHash: "3000",
            maxContextWindow: 372_000,
            multiAgentVersion: "v2",
            toolMode: "code_mode_only",
            useResponsesLite: true,
        },
    },
} as const satisfies Record<string, NonNullable<ModelProfile["parameters"]["referenceClient"]>>;

export function codexReferenceClient(
    modelId: keyof typeof references,
): NonNullable<ModelProfile["parameters"]["referenceClient"]> {
    return references[modelId];
}
