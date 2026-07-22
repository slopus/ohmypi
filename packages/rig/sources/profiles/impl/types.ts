import type { AnyDefinedTool } from "../../agent/types.js";
import type {
    Model,
    ProviderImageProfile,
    ProviderToolProfile,
    ServiceTier,
} from "../../providers/types.js";
import type { ProfileProviderType } from "./ProfileProviderType.js";

export type { ProfileProviderType } from "./ProfileProviderType.js";
export type ModelVendor = "anthropic" | "moonshot" | "openai" | "xai" | "zai";
export type ProfileWireMode =
    | "bedrock-mantle-or-runtime"
    | "claude-agent-sdk"
    | "kimi-chat-completions"
    | "openai-responses"
    | "grok-openai-responses";

export interface PromptProvenance {
    client: string;
    version: string;
    source: string;
    captureMethod: string;
    clientTools: readonly string[];
}

export interface PromptAsset {
    text: string;
    provenance: PromptProvenance;
    render?(context: ProfilePromptContext): string;
}

export interface ProfilePromptPatch {
    id: string;
    description: string;
    find: string;
    replace: string;
}

export interface ProfilePromptContext {
    claudeConfigDirectory?: string;
    claudeGitStatus?: string;
    cwd?: string;
    effort?: string;
    home?: string;
    isGitRepository?: boolean;
    modelId: string;
    osVersion?: string;
    platform?: NodeJS.Platform;
    projectRoot?: string;
    providerId: string;
    shell?: string;
}

export type ProfilePromptAppendContext = ProfilePromptContext;

export interface ProfilePromptAppend {
    id: string;
    description: string;
    includeWithSystemPromptOverride?: true;
    render(context: ProfilePromptAppendContext): string | undefined;
}

export interface ProfilePrompt {
    original?: PromptAsset;
    patches: readonly ProfilePromptPatch[];
    appends: readonly ProfilePromptAppend[];
}

export interface ModelProfile {
    id: string;
    providerType: ProfileProviderType;
    vendor: ModelVendor;
    model: Model;
    imageProfile: ProviderImageProfile;
    toolProfile: ProviderToolProfile;
    tools: {
        base: readonly AnyDefinedTool[];
        collaboration: readonly AnyDefinedTool[];
    };
    prompt: ProfilePrompt;
    parameters: {
        wireMode: ProfileWireMode;
        wireModelId?: string;
        maxOutputTokens?: number;
        serviceTiers: readonly ServiceTier[];
        contextWindow?: number;
        autoCompactWindow?: number;
        thinkingLevels: readonly string[];
        defaultThinkingLevel: string;
        referenceClient?: {
            contextWindow?: number;
            defaultThinkingLevel: string;
            thinkingLevels: readonly string[];
            request: Readonly<Record<string, unknown>>;
        };
    };
}
