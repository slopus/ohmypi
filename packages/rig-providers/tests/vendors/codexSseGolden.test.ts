import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { describe, expect, it } from "vitest";

import { CodexProvider } from "@/vendors/codex/CodexProvider.js";
import { codexCliTools } from "./codexCliTools.js";
import { codexCliPrompt } from "./codexCliPrompt.js";
import { codexSkills } from "./codexSkills.js";

const cases = [
    ["gpt-5.5", "codex-gpt-5-5-low"],
    ["gpt-5.6-sol", "codex-gpt-5-6-sol-low"],
    ["gpt-5.6-terra", "codex-gpt-5-6-terra-low"],
    ["gpt-5.6-luna", "codex-gpt-5-6-luna-low"],
] as const;

describe("Codex SSE goldens", () => {
    it.each(cases)("sends the captured %s SSE tool contract", async (model, stem) => {
        const golden = await fixture(`${stem}.sse.json`);
        const prompt = codexCliPrompt(model, "sse");
        expect(promptEnvelope(golden.request, false)).toEqual(prompt);
        let captured: Record<string, any> | undefined;
        const server = createServer(async (request, response) => {
            captured = JSON.parse(await readBody(request));
            completeSse(response);
        });
        server.listen(0, "127.0.0.1");
        await new Promise<void>((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });
        const address = server.address();
        if (typeof address !== "object" || address === null) throw new Error("Missing port.");

        try {
            const provider = new CodexProvider({
                credential: { name: "codex-api-key", credential: { apiKey: "test" } } as never,
                endpoint: `http://127.0.0.1:${address.port}/v1`,
                model,
                transport: "sse",
            });
            const session = await provider.session("<SESSION_ID>", {
                context: {
                    instructions: prompt.instructions,
                    messages: prompt.systemMessages.map((content) => ({
                        role: "system" as const,
                        content,
                    })),
                },
                skills: codexSkills,
                tools: codexCliTools(model),
            });
            for await (const event of session.run({
                context: {
                    messages: [
                        { role: "user", content: "Reply with OK." },
                    ],
                },
                effort: "low",
            })) {
                if (event.type === "done") expect(event.state).toBe("normal");
            }
            session.destroy();

            expect(captured).toBeDefined();
            expect(protocolProjection(captured!)).toEqual(protocolProjection(golden.request));
            expect(captured!.prompt_cache_key).toBe("<SESSION_ID>");
            expect(promptEnvelope(captured!)).toEqual(promptEnvelope(golden.request));
            expect(toolDefinitions(captured!)).toEqual(
                await fixture(`${stem}.sse.tools.json`),
            );
            if (model.startsWith("gpt-5.6-")) {
                expect(captured!.tools).toBeUndefined();
                expect(captured!.input[0].type).toBe("additional_tools");
            } else {
                expect(captured!.tools).toBeDefined();
                expect(captured!.input.some((item: any) => item.type === "additional_tools")).toBe(false);
            }
        } finally {
            server.close();
        }
    });
});

async function fixture(name: string): Promise<any> {
    return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

function readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => { body += chunk; });
        request.once("end", () => resolve(body));
        request.once("error", reject);
    });
}

function completeSse(response: ServerResponse): void {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
        `data: ${JSON.stringify({
            type: "response.completed",
            response: {
                id: "response",
                output: [],
                usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
            },
        })}\n\ndata: [DONE]\n\n`,
    );
}

function protocolProjection(request: Record<string, any>): Record<string, unknown> {
    return {
        model: request.model,
        tool_choice: request.tool_choice,
        parallel_tool_calls: request.parallel_tool_calls,
        reasoning: request.reasoning,
        store: request.store,
        stream: request.stream,
        include: request.include,
        text: request.text,
        hasInstructions: request.instructions !== undefined,
        hasTopLevelTools: request.tools !== undefined,
        inputTypes: [...new Set((request.input ?? []).map((item: any) => item.type))],
    };
}

function toolDefinitions(request: Record<string, any>): unknown[] {
    if (Array.isArray(request.tools)) return request.tools;
    return request.input.find((item: any) => item.type === "additional_tools")?.tools ?? [];
}

function promptEnvelope(request: Record<string, any>, includeSkills = true): {
    instructions: string;
    systemMessages: string[][];
} {
    const systemMessages = (request.input ?? [])
        .filter((item: any) => item.type === "message" && item.role === "developer")
        .map((item: any) =>
            (typeof item.content === "string" ? [item.content] : item.content ?? [])
                .map((content: any) => typeof content === "string" ? content : content.text)
                .filter((text: unknown): text is string => typeof text === "string"),
        )
        .map((message: string[]) =>
            includeSkills
                ? message
                : message.filter((part) => !part.startsWith("<skills_instructions>")),
        )
        .filter((message: string[]) => message.length > 0);
    const topLevelInstructions =
        typeof request.instructions === "string" ? request.instructions : undefined;
    const developerInstructions =
        topLevelInstructions === undefined &&
        systemMessages[0]?.[0]?.startsWith("You are Codex,")
            ? systemMessages.shift()?.[0]
            : undefined;
    const instructions = topLevelInstructions ?? developerInstructions;
    if (instructions === undefined) throw new Error("SSE capture omitted instructions.");
    return { instructions, systemMessages };
}
