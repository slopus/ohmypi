import {
    Agent,
    createNodeAgentContext,
    type AgentOptions,
    type AnyDefinedTool,
    type SubagentContext,
} from "../agent/index.js";
import type { Message } from "../agent/types.js";
import { NativeProxessManager } from "../processes/index.js";
import { createClaudeSdkProvider } from "../providers/claude-sdk.js";
import { createCodexProvider, type CodexProviderOptions } from "../providers/codex.js";
import { modelOpenaiGpt55 } from "../providers/models.js";
import { claudeCodeTools } from "../tools/claude/index.js";
import { codexTools } from "../tools/codex/index.js";
import { agentTool } from "../tools/Agent.js";
import type { CodingAssistantRuntime } from "./CodingAssistantRuntime.js";
import { createDefaultInstructions } from "./createDefaultInstructions.js";

export interface CreateCodingAssistantAgentOptions {
    cwd: string;
    agentId?: string;
    apiKey?: string;
    effort?: string;
    instructions?: string;
    messages?: readonly Message[];
    modelId?: string;
    processManager?: NativeProxessManager;
    subagents?: SubagentContext;
}

export function createCodingAssistantAgent(
    options: CreateCodingAssistantAgentOptions,
): CodingAssistantRuntime {
    const processManager = options.processManager ?? new NativeProxessManager();
    const context = createNodeAgentContext({
        cwd: options.cwd,
        processManager,
    });
    if (options.subagents !== undefined) {
        context.subagents = options.subagents;
    }
    const modelId = options.modelId ?? modelOpenaiGpt55.id;
    const baseTools: readonly AnyDefinedTool[] = modelId.startsWith("anthropic/")
        ? claudeCodeTools
        : codexTools;
    const tools = options.subagents?.canSpawn === true ? [...baseTools, agentTool] : [...baseTools];
    const provider = modelId.startsWith("anthropic/")
        ? createClaudeSdkProvider({
              agentContext: context,
              tools,
          })
        : createCodexProvider(toCodexProviderOptions(options));
    const agentOptions: AgentOptions = {
        provider,
        modelId,
        context,
        ...(options.agentId !== undefined ? { id: options.agentId } : {}),
        instructions: options.instructions ?? createDefaultInstructions(options.cwd),
        ...(options.messages !== undefined ? { messages: options.messages } : {}),
        tools,
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
