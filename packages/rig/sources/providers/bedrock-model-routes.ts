import {
    modelAnthropicFable5,
    modelAnthropicOpus48,
    modelAnthropicSonnet5,
    modelZaiGlm47Flash,
    modelZaiGlm5,
} from "./models.js";
import {
    modelBedrockOpenaiGpt56Luna,
    modelBedrockOpenaiGpt56Sol,
    modelBedrockOpenaiGpt56Terra,
} from "../profiles/impl/bedrockModelProfileVariants.js";
import type { Model } from "./types.js";

export type BedrockEndpoint = "bedrock-mantle" | "bedrock-runtime";

export interface BedrockRuntimeInferenceProfiles {
    default: string;
    regionPrefixes: Readonly<Record<string, string>>;
}

export interface BedrockModelRoute {
    apiModelId: string;
    contextWindow: number;
    endpoints: readonly BedrockEndpoint[];
    input: readonly ("image" | "text")[];
    maxTokens: number;
    model: Model;
    mantleApiModelId?: string;
    preferredEndpoint: BedrockEndpoint;
    provider: "anthropic" | "moonshot" | "openai" | "zai";
    reasoningMode:
        | "adaptive"
        | "glm-effort"
        | "glm-toggle"
        | "kimi-always"
        | "kimi-toggle"
        | "openai"
        | "unsupported";
    runtimeInferenceProfiles?: BedrockRuntimeInferenceProfiles;
    supportedRegions?: readonly string[];
}

const BEDROCK_COMMERCIAL_MODEL_REGIONS = [
    "af-south-1",
    "ap-east-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-northeast-3",
    "ap-south-1",
    "ap-south-2",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-southeast-3",
    "ap-southeast-4",
    "ap-southeast-5",
    "ap-southeast-6",
    "ap-southeast-7",
    "ca-central-1",
    "ca-west-1",
    "eu-central-1",
    "eu-central-2",
    "eu-north-1",
    "eu-south-1",
    "eu-south-2",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "il-central-1",
    "me-central-1",
    "me-south-1",
    "mx-central-1",
    "sa-east-1",
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
] as const;

const BEDROCK_GLM_REGIONS = [
    "us-east-1",
    "us-east-2",
    "us-west-2",
    "ap-northeast-1",
    "ap-south-1",
    "ap-southeast-2",
    "ap-southeast-3",
    "ap-southeast-4",
    "eu-north-1",
    "eu-west-2",
    "sa-east-1",
] as const;

const BEDROCK_GLM_FLASH_REGIONS = [
    ...BEDROCK_GLM_REGIONS,
    "eu-central-1",
    "eu-south-1",
    "eu-west-1",
] as const;

const GLOBAL_OPUS_48_PROFILES: BedrockRuntimeInferenceProfiles = {
    default: "global.anthropic.claude-opus-4-8",
    regionPrefixes: {
        "ap-northeast-1": "jp.anthropic.claude-opus-4-8",
        "ap-northeast-3": "jp.anthropic.claude-opus-4-8",
        "ap-southeast-2": "au.anthropic.claude-opus-4-8",
        "eu-": "eu.anthropic.claude-opus-4-8",
        "us-": "us.anthropic.claude-opus-4-8",
    },
};

const GLOBAL_SONNET_5_PROFILES: BedrockRuntimeInferenceProfiles = {
    default: "global.anthropic.claude-sonnet-5",
    regionPrefixes: { "us-": "us.anthropic.claude-sonnet-5" },
};

const GLOBAL_FABLE_5_PROFILES: BedrockRuntimeInferenceProfiles = {
    default: "global.anthropic.claude-fable-5",
    regionPrefixes: {
        "eu-": "eu.anthropic.claude-fable-5",
        "us-": "us.anthropic.claude-fable-5",
    },
};

export const BEDROCK_MODEL_ROUTES: readonly BedrockModelRoute[] = [
    {
        apiModelId: "anthropic.claude-sonnet-5",
        contextWindow: 1_000_000,
        endpoints: ["bedrock-runtime", "bedrock-mantle"],
        input: ["text", "image"],
        maxTokens: 128_000,
        model: modelAnthropicSonnet5,
        preferredEndpoint: "bedrock-runtime",
        provider: "anthropic",
        reasoningMode: "adaptive",
        runtimeInferenceProfiles: GLOBAL_SONNET_5_PROFILES,
        supportedRegions: BEDROCK_COMMERCIAL_MODEL_REGIONS,
    },
    {
        apiModelId: "anthropic.claude-fable-5",
        contextWindow: 1_000_000,
        endpoints: ["bedrock-runtime", "bedrock-mantle"],
        input: ["text", "image"],
        maxTokens: 128_000,
        model: modelAnthropicFable5,
        preferredEndpoint: "bedrock-runtime",
        provider: "anthropic",
        reasoningMode: "adaptive",
        runtimeInferenceProfiles: GLOBAL_FABLE_5_PROFILES,
        supportedRegions: BEDROCK_COMMERCIAL_MODEL_REGIONS,
    },
    {
        apiModelId: "anthropic.claude-opus-4-8",
        contextWindow: 1_000_000,
        endpoints: ["bedrock-runtime", "bedrock-mantle"],
        input: ["text", "image"],
        maxTokens: 128_000,
        model: modelAnthropicOpus48,
        preferredEndpoint: "bedrock-runtime",
        provider: "anthropic",
        reasoningMode: "adaptive",
        runtimeInferenceProfiles: GLOBAL_OPUS_48_PROFILES,
        supportedRegions: BEDROCK_COMMERCIAL_MODEL_REGIONS,
    },
    {
        apiModelId: "zai.glm-5",
        contextWindow: 200_000,
        endpoints: ["bedrock-runtime", "bedrock-mantle"],
        input: ["text"],
        maxTokens: 128_000,
        model: modelZaiGlm5,
        preferredEndpoint: "bedrock-runtime",
        provider: "zai",
        reasoningMode: "glm-effort",
        supportedRegions: BEDROCK_GLM_REGIONS,
    },
    {
        apiModelId: "zai.glm-4.7-flash",
        contextWindow: 203_000,
        endpoints: ["bedrock-runtime", "bedrock-mantle"],
        input: ["text"],
        maxTokens: 4_000,
        model: modelZaiGlm47Flash,
        preferredEndpoint: "bedrock-runtime",
        provider: "zai",
        reasoningMode: "glm-toggle",
        supportedRegions: BEDROCK_GLM_FLASH_REGIONS,
    },
    {
        apiModelId: "openai.gpt-5.6-sol",
        contextWindow: 272_000,
        endpoints: ["bedrock-mantle"],
        input: ["text", "image"],
        maxTokens: 128_000,
        model: modelBedrockOpenaiGpt56Sol,
        preferredEndpoint: "bedrock-mantle",
        provider: "openai",
        reasoningMode: "openai",
        supportedRegions: ["us-east-1", "us-east-2"],
    },
    {
        apiModelId: "openai.gpt-5.6-terra",
        contextWindow: 272_000,
        endpoints: ["bedrock-mantle"],
        input: ["text", "image"],
        maxTokens: 128_000,
        model: modelBedrockOpenaiGpt56Terra,
        preferredEndpoint: "bedrock-mantle",
        provider: "openai",
        reasoningMode: "openai",
        supportedRegions: ["us-east-1", "us-east-2", "us-west-2"],
    },
    {
        apiModelId: "openai.gpt-5.6-luna",
        contextWindow: 272_000,
        endpoints: ["bedrock-mantle"],
        input: ["text", "image"],
        maxTokens: 128_000,
        model: modelBedrockOpenaiGpt56Luna,
        preferredEndpoint: "bedrock-mantle",
        provider: "openai",
        reasoningMode: "openai",
        supportedRegions: ["us-east-1", "us-east-2", "us-west-2"],
    },
];
