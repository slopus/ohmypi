import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import { runAgentLoop } from "./loop.js";
import { defineTool } from "./types.js";
import { createJustBashToolHarness } from "../tools/testing/harness.js";
import {
  defineModel,
  defineProvider,
  type AssistantContent,
  type AssistantMessage,
  type AssistantMessageEvent,
  type Context,
  type InferenceStream,
  type StopReason,
  type StreamOptions,
  type Usage,
} from "../providers/types.js";

describe("agent loop live", () => {
  it("executes mock tools and feeds rendered tool answers back to the model", async () => {
    const model = defineModel({
      id: "mock/model",
      name: "Mock Model",
      thinkingLevels: ["off", "high"],
    });
    const contexts: Context[] = [];
    const streamOptions: StreamOptions[] = [];

    const provider = defineProvider({
      id: "mock",
      models: [model],
      stream(_model, context, options) {
        contexts.push(context);
        if (options !== undefined) {
          streamOptions.push(options);
        }

        if (contexts.length === 1) {
          return streamFor(
            assistantMessage(
              [
                {
                  type: "toolCall",
                  id: "call-add",
                  name: "add",
                  arguments: { left: 2, right: 5 },
                },
                {
                  type: "toolCall",
                  id: "call-shout",
                  name: "shout",
                  arguments: { value: "dublin" },
                },
              ],
              "toolUse",
            ),
          );
        }

        return streamFor(
          assistantMessage(
            [
              {
                type: "text",
                text: "done",
              },
            ],
            "stop",
          ),
        );
      },
    });

    const addExecute = vi.fn((args: { left: number; right: number }) => ({
      total: args.left + args.right,
    }));
    const addToLLM = vi.fn((result: { total: number }) => [
      {
        type: "text" as const,
        text: `total=${result.total}`,
      },
    ]);
    const addTool = defineTool({
      name: "add",
      label: "Add",
      description: "Adds two numbers.",
      arguments: Type.Object({
        left: Type.Number(),
        right: Type.Number(),
      }),
      returnType: Type.Object({
        total: Type.Number(),
      }),
      execute: addExecute,
      toLLM: addToLLM,
      locks: [],
    });

    const shoutExecute = vi.fn((args: { value: string }) => ({
      shouted: args.value.toUpperCase(),
    }));
    const shoutToLLM = vi.fn((result: { shouted: string }) => [
      {
        type: "text" as const,
        text: result.shouted,
      },
    ]);
    const shoutTool = defineTool({
      name: "shout",
      label: "Shout",
      description: "Uppercases text.",
      arguments: Type.Object({
        value: Type.String(),
      }),
      returnType: Type.Object({
        shouted: Type.String(),
      }),
      execute: shoutExecute,
      toLLM: shoutToLLM,
      locks: [],
    });

    let nextId = 0;
    let timestamp = 1_000;
    const harness = createJustBashToolHarness();
    const result = await runAgentLoop({
      provider,
      modelId: "mock/model",
      effort: "high",
      tools: [addTool, shoutTool],
      instructions: "Use tools when needed.",
      messages: [
        {
          role: "user",
          id: "user-1",
          blocks: [
            {
              type: "text",
              text: "Add 2 and 5, then shout dublin.",
            },
          ],
        },
      ],
      idFactory: () => `generated-${++nextId}`,
      now: () => timestamp++,
      context: harness.context,
    });

    expect(result.stopReason).toBe("stop");
    expect(contexts).toHaveLength(2);
    expect(streamOptions).toHaveLength(2);
    expect(streamOptions[0]?.thinking).toBe("high");

    expect(contexts[0]?.systemPrompt).toBe("Use tools when needed.");
    expect(contexts[0]?.tools?.map((tool) => tool.name)).toEqual([
      "add",
      "shout",
    ]);

    expect(addExecute).toHaveBeenCalledExactlyOnceWith(
      {
        left: 2,
        right: 5,
      },
      expect.objectContaining({
        fs: expect.objectContaining({ cwd: "/workspace" }),
        bash: expect.objectContaining({ cwd: "/workspace" }),
      }),
    );
    expect(addToLLM).toHaveBeenCalledExactlyOnceWith({ total: 7 });
    expect(shoutExecute).toHaveBeenCalledExactlyOnceWith(
      { value: "dublin" },
      expect.objectContaining({
        fs: expect.objectContaining({ cwd: "/workspace" }),
        bash: expect.objectContaining({ cwd: "/workspace" }),
      }),
    );
    expect(shoutToLLM).toHaveBeenCalledExactlyOnceWith({
      shouted: "DUBLIN",
    });

    expect(contexts[1]?.messages).toHaveLength(4);
    expect(contexts[1]?.messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "call-add",
      toolName: "add",
      content: [{ type: "text", text: "total=7" }],
      isError: false,
    });
    expect(contexts[1]?.messages[3]).toMatchObject({
      role: "toolResult",
      toolCallId: "call-shout",
      toolName: "shout",
      content: [{ type: "text", text: "DUBLIN" }],
      isError: false,
    });

    expect(result.messages).toHaveLength(4);
    expect(result.messages[2]).toMatchObject({
      role: "agent",
      blocks: [
        {
          type: "tool_result",
          toolCallId: "call-add",
          toolName: "add",
          rendered: [{ type: "text", text: "total=7" }],
        },
        {
          type: "tool_result",
          toolCallId: "call-shout",
          toolName: "shout",
          rendered: [{ type: "text", text: "DUBLIN" }],
        },
      ],
    });
  });
});

function streamFor(message: AssistantMessage): InferenceStream {
  const doneReason = toDoneReason(message.stopReason);

  return {
    async *[Symbol.asyncIterator](): AsyncIterator<AssistantMessageEvent> {
      yield {
        type: "start",
        partial: message,
      };
      yield {
        type: "done",
        reason: doneReason,
        message,
      };
    },
    result: async () => message,
  };
}

function assistantMessage(
  content: readonly AssistantContent[],
  stopReason: StopReason,
): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: "mock",
    provider: "mock",
    model: "mock/model",
    usage: zeroUsage(),
    stopReason,
    timestamp: 0,
  };
}

function toDoneReason(
  reason: StopReason,
): Extract<StopReason, "stop" | "length" | "toolUse"> {
  if (reason === "stop" || reason === "length" || reason === "toolUse") {
    return reason;
  }

  throw new Error(`Cannot create done event for stop reason '${reason}'`);
}

function zeroUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}
