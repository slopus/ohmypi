import { Agent, createNodeAgentContext, type AgentOptions } from "../agent/index.js";
import { NativeProxessManager } from "../processes/index.js";
import { createClaudeSdkProvider } from "../providers/claude-sdk.js";
import { createCodexProvider, type CodexProviderOptions } from "../providers/codex.js";
import { modelOpenaiGpt55 } from "../providers/models.js";
import { claudeCodeTools } from "../tools/claude/index.js";
import type { CodingAssistantRuntime } from "./CodingAssistantRuntime.js";
import { createDefaultInstructions } from "./createDefaultInstructions.js";

export interface CreateCodingAssistantAgentOptions {
    cwd: string;
    apiKey?: string;
    effort?: string;
    instructions?: string;
    modelId?: string;
    processManager?: NativeProxessManager;
}

export function createCodingAssistantAgent(
    options: CreateCodingAssistantAgentOptions,
): CodingAssistantRuntime {
    const processManager = options.processManager ?? new NativeProxessManager();
    const context = createNodeAgentContext({
        cwd: options.cwd,
        processManager,
    });
    const modelId = options.modelId ?? modelOpenaiGpt55.id;
    const provider = modelId.startsWith("anthropic/")
        ? createClaudeSdkProvider({
              agentContext: context,
              tools: claudeCodeTools,
          })
        : createCodexProvider(toCodexProviderOptions(options));
    const agentOptions: AgentOptions = {
        provider,
        modelId,
        context,
        instructions: options.instructions ?? createDefaultInstructions(options.cwd),
        printToConsole: false,
    };
    if (options.effort !== undefined) {
        agentOptions.effort = options.effort;
    }

    return {
        agent: new Agent(agentOptions),
        context,
        cwd: options.cwd,
        processManager,
        provider,
    };
}

function toCodexProviderOptions(options: CreateCodingAssistantAgentOptions): CodexProviderOptions {
    const providerOptions: CodexProviderOptions = {};
    if (options.apiKey !== undefined) {
        providerOptions.apiKey = options.apiKey;
    }

    return providerOptions;
}
