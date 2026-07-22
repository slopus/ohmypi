import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import { defineTool } from "../agent/types.js";
import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { createCodexCollaborationNamespaceTool } from "./createCodexCollaborationNamespaceTool.js";

describe("createCodexCollaborationNamespaceTool", () => {
    it("translates official encrypted collaboration calls without exposing plaintext", async () => {
        const spawnExecute = vi.fn(() => ({ ok: true }));
        const followupExecute = vi.fn(() => ({ ok: true }));
        const sendExecute = vi.fn(() => ({ ok: true }));
        const spawn = createCodexCollaborationNamespaceTool(tool("spawn_agent", spawnExecute));
        const followup = createCodexCollaborationNamespaceTool(
            tool("followup_task", followupExecute),
        );
        const send = createCodexCollaborationNamespaceTool(tool("send_message", sendExecute));
        const context = createJustBashToolHarness().context;

        await spawn.execute(
            {
                fork_turns: "2",
                message: "opaque-spawn",
                model: "gpt-5.6-sol",
                reasoning_effort: "high",
                task_name: "audit",
            } as never,
            context,
            {},
        );
        await followup.execute(
            { message: "opaque-followup", target: "/root/audit" } as never,
            context,
            {},
        );
        await send.execute(
            { message: "opaque-message", target: "/root/audit" } as never,
            context,
            {},
        );

        expect(spawnExecute).toHaveBeenCalledWith(
            {
                context: "parent",
                encrypted_message: "opaque-spawn",
                last_n_turns: 2,
                message: "",
                model: "openai/gpt-5.6-sol",
                effort: "high",
                task_name: "audit",
            },
            context,
            {},
        );
        expect(followupExecute).toHaveBeenCalledWith(
            {
                encrypted_message: "opaque-followup",
                message: "",
                target: "/root/audit",
            },
            context,
            {},
        );
        expect(sendExecute).toHaveBeenCalledWith(
            {
                encrypted_message: "opaque-message",
                message: "",
                target: "/root/audit",
            },
            context,
            {},
        );
    });

    it("rejects fork counts outside the official none, all, or positive-integer contract", () => {
        const spawn = createCodexCollaborationNamespaceTool(tool("spawn_agent", vi.fn()));
        const context = createJustBashToolHarness().context;

        expect(() =>
            spawn.execute(
                { fork_turns: "0", message: "opaque", task_name: "audit" } as never,
                context,
                {},
            ),
        ).toThrow("fork_turns must be `none`, `all`, or a positive integer string");
    });
});

function tool(name: string, execute: (args: unknown) => unknown) {
    return defineTool({
        name,
        label: name,
        description: name,
        arguments: Type.Object({}),
        returnType: Type.Object({ ok: Type.Boolean() }),
        shouldReviewInAutoMode: () => false,
        execute: execute as never,
        toLLM: () => [],
        toUI: () => name,
        locks: [],
    });
}
