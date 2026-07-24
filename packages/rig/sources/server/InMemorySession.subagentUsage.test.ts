import { describe, expect, it } from "vitest";

import { Agent, createNodeAgentContext } from "../agent/index.js";
import { NativeProcessManager } from "../processes/index.js";
import { createEventIdFactory, type ModelCatalog } from "../protocol/index.js";
import type { CodingAssistantRuntime } from "../runtime/CodingAssistantRuntime.js";
import type { CreateCodingAssistantAgentOptions } from "../runtime/createCodingAssistantAgent.js";
import {
    defineModel,
    defineProvider,
    type AssistantMessage,
    type InferenceStream,
    type Usage,
} from "@slopus/rig-execution";
import { InMemorySession } from "./InMemorySession.js";

describe("InMemorySession subagent usage", () => {
    it("publishes cumulative normalized usage across every subagent turn", async () => {
        const model = defineModel({
            defaultThinkingLevel: "off",
            id: "anthropic/subagent-usage",
            name: "Subagent usage",
            thinkingLevels: ["off"],
        });
        const responses = [
            usage({ cacheRead: 100, input: 900, output: 100 }),
            usage({ cacheRead: 900, input: 100, output: 100 }),
        ];
        const provider = defineProvider({
            id: "claude",
            models: [model],
            stream: () => responseStream(model.id, responses.shift()!),
        });
        const catalog: ModelCatalog = {
            defaultModelId: model.id,
            defaultProviderId: provider.id,
            models: [model],
            providers: [{ models: [model], providerId: provider.id }],
        };
        const session = new InMemorySession({
            createEventId: createEventIdFactory(),
            createRuntime: (options) => createRuntime(options, provider),
            metadata: {
                depth: 1,
                description: "Measure provider usage",
                parentSessionId: "session-parent",
                rootSessionId: "session-parent",
                type: "subagent",
            },
            modelCatalog: catalog,
            request: {
                cwd: "/tmp/rig-subagent-usage",
                modelId: model.id,
                providerId: provider.id,
            },
        });

        const first = session.submit({ text: "First turn." });
        await expect(session.waitForRun(first.runId)).resolves.toEqual({ status: "completed" });
        const second = session.submit({ text: "Second turn." });
        await expect(session.waitForRun(second.runId)).resolves.toEqual({ status: "completed" });

        expect(session.subagentSummary().usage).toMatchObject({
            cacheRead: 1_000,
            cacheWrite: 0,
            input: 1_000,
            output: 200,
            totalTokens: 2_200,
        });
        expect(session.snapshot().cumulativeUsage).toMatchObject({
            cacheRead: 1_000,
            input: 1_000,
            totalTokens: 2_200,
        });
        expect(session.subagentSummary().sessionTokenCount).toEqual({
            lastContextTokens: 1_100,
            totalTokens: 1_100,
        });
        expect(session.state().sessionTokenCount).toEqual({
            lastContextTokens: 1_100,
            totalTokens: 1_100,
        });
        expect(session.subagentSummary().totalTokens).toBe(1_100);
    });
});

function createRuntime(
    options: CreateCodingAssistantAgentOptions,
    provider: ReturnType<typeof defineProvider>,
): CodingAssistantRuntime {
    const processManager = new NativeProcessManager();
    const context = createNodeAgentContext({ cwd: options.cwd, processManager });
    return {
        agent: new Agent({
            context,
            modelId: options.modelId ?? provider.models[0]?.id ?? "",
            printToConsole: false,
            provider,
            tools: [],
        }),
        context,
        cwd: options.cwd,
        executor: provider,
        processManager,
    };
}

function responseStream(model: string, responseUsage: Usage): InferenceStream {
    const message: AssistantMessage = {
        api: "test",
        content: [{ text: "Completed.", type: "text" }],
        model,
        provider: "claude",
        role: "assistant",
        stopReason: "stop",
        timestamp: 1,
        usage: responseUsage,
    };
    return {
        async *[Symbol.asyncIterator]() {
            yield { partial: message, type: "start" as const };
            yield { message, reason: "stop" as const, type: "done" as const };
        },
        async result() {
            return message;
        },
    };
}

function usage(values: { cacheRead: number; input: number; output: number }): Usage {
    return {
        cacheRead: values.cacheRead,
        cacheWrite: 0,
        cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
        input: values.input,
        output: values.output,
        totalTokens: values.cacheRead + values.input + values.output,
    };
}
