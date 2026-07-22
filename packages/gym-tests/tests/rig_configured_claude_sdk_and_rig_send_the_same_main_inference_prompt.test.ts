import { afterEach, describe, expect, it } from "vitest";

import { createPermissionInstructions } from "../../rig/sources/agent/createPermissionInstructions.js";
import {
    claudeFable5Prompt,
    claudeOpus48Prompt,
    claudeSonnet5Prompt,
} from "../../rig/sources/profiles/claude/prompt.js";
import type { ProfilePrompt } from "../../rig/sources/profiles/impl/types.js";
import type { AnyDefinedTool } from "../../rig/sources/agent/types.js";
import { goalTools } from "../../rig/sources/tools/goals/index.js";
import { claudeAnthropicFable5Profile } from "../../rig/sources/profiles/claude-fable-5.js";
import { claudeAnthropicOpus48Profile } from "../../rig/sources/profiles/claude-opus-4-8.js";
import { claudeAnthropicSonnet5Profile } from "../../rig/sources/profiles/claude-sonnet-5.js";
import {
    createGym,
    type Gym,
    type InterceptedHttpExchange,
    type InterceptedHttpRequest,
} from "@slopus/rig-gym";

const BLOCK_MARKER = "RIG_GYM_BLOCKED_BEFORE_ANTHROPIC";
const DIRECT_PROBE_PATH = "direct-claude-sdk-probe.mjs";
const DIRECT_OPTIONS_PATH = "direct-claude-sdk-options.json";
const MCP_DESCRIPTION_LIMIT = 2_048;
const RIG_MCP_INSTRUCTIONS =
    "Use these rig project tools for filesystem, shell, search, and editing work. Claude Code built-in tools are disabled for this session.";
const USER_PROMPT = "CLAUDE_PAYLOAD_INSPECTION_MARKER";
const ULTRACODE_PROMPT = "Use ultracode for CLAUDE_ULTRACODE_PAYLOAD_INSPECTION_MARKER.";
const running = new Set<Gym>();

const claudeModels = [
    {
        name: "Opus 4.8",
        rigModelId: "anthropic/opus-4-8",
        sdkModelId: "opus[1m]",
        profilePrompt: claudeOpus48Prompt,
        profileTools: claudeAnthropicOpus48Profile.tools,
        wireModelId: "claude-opus-4-8",
    },
    {
        name: "Sonnet 5",
        rigModelId: "anthropic/sonnet-5",
        sdkModelId: "sonnet[1m]",
        profilePrompt: claudeSonnet5Prompt,
        profileTools: claudeAnthropicSonnet5Profile.tools,
        wireModelId: "claude-sonnet-5",
    },
    {
        name: "Fable 5",
        rigModelId: "anthropic/fable-5",
        sdkModelId: "claude-fable-5[1m]",
        profilePrompt: claudeFable5Prompt,
        profileTools: claudeAnthropicFable5Profile.tools,
        wireModelId: "claude-fable-5",
    },
] as const satisfies readonly ClaudeModelCase[];

function rigTools(modelCase: ClaudeModelCase): readonly AnyDefinedTool[] {
    return [...modelCase.profileTools.base, ...modelCase.profileTools.collaboration, ...goalTools];
}

function rigSystemPromptTemplate(modelCase: ClaudeModelCase): string {
    const context = { modelId: modelCase.rigModelId, providerId: "claude" };
    return [
        modelCase.profilePrompt.original?.text ?? "",
        ...modelCase.profilePrompt.appends.map((append) => append.render(context) ?? ""),
        createPermissionInstructions("full_access"),
    ]
        .filter((part) => part.length > 0)
        .join("\n\n");
}

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

// This checks Rig's Agent SDK transport contract. The direct probe deliberately receives
// Rig's custom prompt and tools, so this is not a Claude Code default-prompt fidelity test.
describe("Rig-configured Claude Agent SDK and Rig main inference prompts", () => {
    it.each(claudeModels)(
        "sends the same complete $name payload, system prompt, and tools",
        async (modelCase) => {
            const gym = await createBlockedClaudeGym(modelCase);
            running.add(gym);

            gym.terminal.type(USER_PROMPT);
            gym.terminal.press("enter");
            const rigExchange = await waitForMainExchange(gym, modelCase.wireModelId);
            const directStartIndex = gym.httpProxy!.exchanges.length;

            const directResult = await gym.runInContainer(
                "node",
                [`/workspace/${DIRECT_PROBE_PATH}`],
                { timeoutMs: 30_000 },
            );
            expect(directResult.stdout).toContain(
                "Direct ClaudeSDK request was blocked as expected.",
            );
            const directExchange = await waitForMainExchange(
                gym,
                modelCase.wireModelId,
                directStartIndex,
            );

            expect(blockedWithoutForwarding(rigExchange)).toBe(true);
            expect(blockedWithoutForwarding(directExchange)).toBe(true);
            expect(mainInferencePayload(directExchange.request)).toEqual(
                mainInferencePayload(rigExchange.request),
            );
            expectExactRigPayload(requestPayload(rigExchange.request), modelCase);
        },
        120_000,
    );

    it("activates compiled Claude ultracode identically through ClaudeSDK and Rig", async () => {
        const modelCase = claudeModels[1];
        const gym = await createBlockedClaudeGym(modelCase, {
            effort: "ultra",
            ultracode: true,
            userPrompt: ULTRACODE_PROMPT,
        });
        running.add(gym);

        gym.terminal.type(ULTRACODE_PROMPT);
        gym.terminal.press("enter");
        const rigExchange = await waitForMainExchange(gym, modelCase.wireModelId);
        const directStartIndex = gym.httpProxy!.exchanges.length;

        const directResult = await gym.runInContainer("node", [`/workspace/${DIRECT_PROBE_PATH}`], {
            timeoutMs: 30_000,
        });
        expect(directResult.stdout).toContain("Direct ClaudeSDK request was blocked as expected.");
        const directExchange = await waitForMainExchange(
            gym,
            modelCase.wireModelId,
            directStartIndex,
        );

        expect(blockedWithoutForwarding(rigExchange)).toBe(true);
        expect(blockedWithoutForwarding(directExchange)).toBe(true);
        expect(mainInferencePayload(directExchange.request)).toEqual(
            mainInferencePayload(rigExchange.request),
        );
        const payload = requestPayload(rigExchange.request);
        expect(payload.output_config).toMatchObject({ effort: "xhigh" });
        expectExactRigPayload(payload, modelCase, "xhigh", ULTRACODE_PROMPT);
    }, 120_000);
});

async function createBlockedClaudeGym(
    modelCase: ClaudeModelCase,
    options: { effort?: string; ultracode?: boolean; userPrompt?: string } = {},
): Promise<Gym> {
    const effort = options.effort ?? "medium";
    const userPrompt = options.userPrompt ?? USER_PROMPT;
    return createGym({
        mode: "docker",
        environment: {
            ANTHROPIC_API_KEY: "gym-placeholder-key",
            ANTHROPIC_BASE_URL: "http://api.anthropic.test",
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
            DISABLE_TELEMETRY: "1",
            RIG_EFFORT: effort,
        },
        files: {
            [DIRECT_OPTIONS_PATH]: JSON.stringify({
                mcpInstructions: RIG_MCP_INSTRUCTIONS,
                model: modelCase.sdkModelId,
                effort,
                systemPrompt: rigSystemPromptTemplate(modelCase),
                tools: rigTools(modelCase).map((tool) => ({
                    description: tool.description,
                    inputSchema: tool.arguments,
                    name: tool.name,
                })),
                ultracode: options.ultracode === true,
                userPrompt,
            }),
            [DIRECT_PROBE_PATH]: directClaudeSdkProbeSource(),
        },
        httpProxy: {
            handler(request) {
                if (request.method === "POST" && new URL(request.url).pathname === "/v1/messages") {
                    return {
                        response: {
                            body: JSON.stringify({
                                type: "error",
                                error: {
                                    type: "invalid_request_error",
                                    message: BLOCK_MARKER,
                                },
                            }),
                            headers: { "content-type": "application/json" },
                            status: 400,
                        },
                    };
                }
                return {
                    response: {
                        body: `${BLOCK_MARKER}: unexpected request`,
                        status: 400,
                    },
                };
            },
        },
        modelId: modelCase.rigModelId,
        providerId: "claude",
        timeoutMs: 30_000,
    });
}

function directClaudeSdkProbeSource(): string {
    return String.raw`
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, release, type as osType, version } from "node:os";
import { join } from "node:path";
import {
    createSdkMcpServer,
    query,
    tool,
} from "/app/packages/rig/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs";
import { z } from "/app/packages/rig/node_modules/zod/index.js";

const options = JSON.parse(await readFile("/workspace/${DIRECT_OPTIONS_PATH}", "utf8"));
const tools = options.tools.map((sourceTool) =>
    tool(
        sourceTool.name,
        sourceTool.description,
        toZodRawShape(sourceTool.inputSchema),
        async () => ({
            content: [{ type: "text", text: "The direct probe never executes tools." }],
            isError: true,
        }),
        { alwaysLoad: true },
    ),
);
const allowedTools = options.tools.map((sourceTool) => "mcp__rig__" + sourceTool.name);
const stream = query({
    prompt: singleMessagePrompt(options.userPrompt),
    options: {
        allowedTools,
        cwd: "/workspace",
        mcpServers: {
            rig: createSdkMcpServer({
                name: "rig",
                instructions: options.mcpInstructions,
                tools,
                alwaysLoad: true,
            }),
        },
        model: options.model,
        env: {
            ...process.env,
            CLAUDE_CODE_DISABLE_BUNDLED_SKILLS: "1",
            CLAUDE_AGENT_SDK_MCP_NO_PREFIX: "1",
            CLAUDE_CODE_MAX_OUTPUT_TOKENS: "128000",
            ...(options.ultracode
                ? { CLAUDE_CODE_EFFORT_LEVEL: "ultracode" }
                : {}),
        },
        extraArgs: { "disable-slash-commands": null },
        effort: options.ultracode ? "xhigh" : options.effort,
        includePartialMessages: true,
        permissionMode: "dontAsk",
        persistSession: false,
        settingSources: [],
        skills: [],
        strictMcpConfig: true,
        systemPrompt: renderRigSystemPrompt(options.systemPrompt),
        thinking: { type: "adaptive" },
        tools: [],
    },
});

try {
    for await (const _message of stream) {
        // Drain the SDK result produced by the deliberately blocked HTTP request.
    }
} catch (error) {
    if (!String(error).includes("${BLOCK_MARKER}")) throw error;
} finally {
    stream.close();
}

console.log("Direct ClaudeSDK request was blocked as expected.");

function renderRigSystemPrompt(template) {
    const cwd = "/workspace";
    const platform = process.platform;
    const shell = process.env.SHELL || "unknown";
    const shellName = shell.includes("zsh") ? "zsh" : shell.includes("bash") ? "bash" : shell;
    const shellDescription = platform === "win32"
        ? shellName + " (use Unix shell syntax, not Windows — e.g., /dev/null not NUL, forward slashes in paths)"
        : shellName;
    const isGitRepository = existsSync(join(cwd, ".git"));
    const osDescription = platform === "win32"
        ? version() + " " + release()
        : osType() + " " + release();
    const configDirectory = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
    return template
        .replaceAll("$CLAUDE_CONFIG_DIR", configDirectory)
        .replaceAll("$CLAUDE_RUNTIME_PROJECT_SLUG", cwd.replace(/[^a-zA-Z0-9]/g, "-"))
        .replaceAll("$CLAUDE_RUNTIME_CWD", cwd)
        .replaceAll("$CLAUDE_RUNTIME_IS_GIT_REPOSITORY", String(isGitRepository))
        .replaceAll("$CLAUDE_RUNTIME_PLATFORM", platform)
        .replaceAll("$CLAUDE_RUNTIME_SHELL", shellDescription)
        .replaceAll("$CLAUDE_RUNTIME_OS_VERSION", osDescription)
        .replaceAll("$CLAUDE_RUNTIME_GIT_STATUS", isGitRepository ? readGitStatus(cwd) : "");
}

function readGitStatus(cwd) {
    const git = (...args) => {
        try {
            return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
        } catch {
            return "";
        }
    };
    const branch = git("branch", "--show-current");
    if (!branch) return "";
    const originHead = git("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD");
    const mainBranch = originHead.startsWith("origin/")
        ? originHead.slice("origin/".length)
        : hasGitRef(cwd, "refs/remotes/origin/main")
          ? "main"
          : hasGitRef(cwd, "refs/remotes/origin/master")
            ? "master"
            : "main";
    const rawStatus = git("--no-optional-locks", "status", "--short");
    const status = rawStatus.length > 2000
        ? rawStatus.slice(0, 2000) + '\n... (truncated because it exceeds 2k characters. If you need more information, run "git status" using BashTool)'
        : rawStatus;
    const log = git("--no-optional-locks", "log", "--oneline", "-n", "5");
    const user = git("config", "user.name");
    return [
        "\n\ngitStatus: This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.",
        "Current branch: " + branch,
        "Main branch (you will usually use this for PRs): " + mainBranch,
        ...(user ? ["Git user: " + user] : []),
        "Status:\n" + (status || "(clean)"),
        "Recent commits:\n" + log,
    ].join("\n\n");
}

function hasGitRef(cwd, ref) {
    try {
        execFileSync("git", ["show-ref", "--verify", "--quiet", ref], { cwd });
        return true;
    } catch {
        return false;
    }
}

async function* singleMessagePrompt(text) {
    yield {
        type: "user",
        parent_tool_use_id: null,
        message: { role: "user", content: text },
        timestamp: new Date(0).toISOString(),
    };
}

function toZodRawShape(schema) {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    return Object.fromEntries(
        Object.entries(properties).map(([name, property]) => [
            name,
            required.has(name) ? toZodSchema(property) : toZodSchema(property).optional(),
        ]),
    );
}

function toZodSchema(schema) {
    let result;
    if (Object.prototype.hasOwnProperty.call(schema, "const")) {
        result = z.literal(toLiteral(schema.const));
    } else if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        result = union(schema.enum.map((value) => z.literal(toLiteral(value))));
    } else if (Array.isArray(schema.anyOf)) {
        result = union(schema.anyOf.map(toZodSchema));
    } else if (schema.type === "string") {
        result = z.string();
    } else if (schema.type === "number" || schema.type === "integer") {
        result = z.number();
    } else if (schema.type === "boolean") {
        result = z.boolean();
    } else if (schema.type === "array") {
        result = z.array(schema.items === undefined ? z.unknown() : toZodSchema(schema.items));
    } else if (schema.type === "object") {
        result = z.object(toZodRawShape(schema));
    } else {
        result = z.unknown();
    }
    return schema.description === undefined ? result : result.describe(schema.description);
}

function union(schemas) {
    if (schemas.length === 0) return z.unknown();
    if (schemas.length === 1) return schemas[0] ?? z.unknown();
    return z.union(schemas);
}

function toLiteral(value) {
    return value === null || ["string", "number", "boolean"].includes(typeof value)
        ? value
        : String(value);
}
`;
}

function expectedApiTools(tools: readonly AnyDefinedTool[]): readonly ApiTool[] {
    return tools
        .map((tool) => ({
            description:
                tool.description.length > MCP_DESCRIPTION_LIMIT
                    ? `${tool.description.slice(0, MCP_DESCRIPTION_LIMIT)}… [truncated]`
                    : tool.description,
            input_schema: expectedInputSchema(tool.arguments as JsonSchema),
            name: tool.name,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

function expectedInputSchema(schema: JsonSchema): JsonSchema {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    return {
        type: "object",
        properties: Object.fromEntries(
            Object.entries(properties).map(([name, property]) => [
                name,
                expectedPropertySchema(property, required.has(name)),
            ]),
        ),
        ...(required.size === 0 ? {} : { required: [...required] }),
        $schema: "http://json-schema.org/draft-07/schema#",
    };
}

function expectedPropertySchema(schema: JsonSchema, includeDescription = true): JsonSchema {
    // The SDK's Zod-to-MCP conversion retains descriptions on required top-level fields.
    // Optional wrappers and nested schema conversion intentionally omit those annotations.
    let result: JsonSchema;
    if (Object.prototype.hasOwnProperty.call(schema, "const")) {
        result = { type: literalType(schema.const), const: schema.const };
    } else if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        result = {
            anyOf: schema.enum.map((value) => ({ type: literalType(value), const: value })),
        };
    } else if (Array.isArray(schema.anyOf)) {
        result = { anyOf: schema.anyOf.map((part) => expectedPropertySchema(part, false)) };
    } else if (schema.type === "string") {
        result = { type: "string" };
    } else if (schema.type === "number" || schema.type === "integer") {
        result = { type: "number" };
    } else if (schema.type === "boolean") {
        result = { type: "boolean" };
    } else if (schema.type === "array") {
        result = {
            type: "array",
            ...(schema.items === undefined
                ? {}
                : { items: expectedPropertySchema(schema.items, false) }),
        };
    } else if (schema.type === "object") {
        const properties = schema.properties ?? {};
        const required = new Set(schema.required ?? []);
        result = {
            type: "object",
            properties: Object.fromEntries(
                Object.entries(properties).map(([name, property]) => [
                    name,
                    expectedPropertySchema(property, false),
                ]),
            ),
            ...(required.size === 0 ? {} : { required: [...required] }),
        };
    } else {
        result = {};
    }

    return includeDescription && typeof schema.description === "string"
        ? { description: schema.description, ...result }
        : result;
}

function literalType(value: unknown): string {
    if (value === null) return "null";
    return typeof value;
}

async function waitForMainExchange(
    gym: Gym,
    wireModelId: string,
    startIndex = 0,
): Promise<InterceptedHttpExchange> {
    let exchange: InterceptedHttpExchange | undefined;
    await expect
        .poll(
            () => {
                exchange = gym.httpProxy?.exchanges
                    .slice(startIndex)
                    .find((candidate) => isMainInference(candidate.request, wireModelId));
                return exchange;
            },
            { timeout: 30_000 },
        )
        .toBeDefined();
    return exchange!;
}

function isMainInference(request: InterceptedHttpRequest, wireModelId: string): boolean {
    if (request.method !== "POST") return false;
    if (new URL(request.url).pathname !== "/v1/messages") return false;
    const payload = requestPayload(request);
    return (
        payload.model === wireModelId &&
        (JSON.stringify(payload.messages).includes(USER_PROMPT) ||
            JSON.stringify(payload.messages).includes(ULTRACODE_PROMPT))
    );
}

function expectExactRigPayload(
    payload: AnthropicRequestPayload,
    modelCase: ClaudeModelCase,
    effort = "medium",
    userPrompt = USER_PROMPT,
): void {
    expect(payload.model).toBe(modelCase.wireModelId);
    expect(payload.output_config).toMatchObject({ effort });
    const system = payload.system;
    expect(system).toEqual([
        {
            type: "text",
            text: expect.stringMatching(
                /^x-anthropic-billing-header: cc_version=\d+\.\d+\.\d+\.[a-f0-9]{3}; cc_entrypoint=sdk-ts;$/u,
            ),
        },
        {
            type: "text",
            text: "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
            cache_control: { type: "ephemeral" },
        },
        {
            type: "text",
            text: expect.any(String),
            cache_control: { type: "ephemeral" },
        },
    ]);
    if (system === undefined) throw new Error("Claude request did not include a system prompt.");
    const fullPrompt = (system[2] as { text: string }).text;
    expect(fullPrompt).toContain(
        "You are an interactive agent that helps users with software engineering tasks.",
    );
    expect(fullPrompt).toContain("Primary working directory: /workspace");
    expect(fullPrompt).not.toContain("$CLAUDE_RUNTIME_");
    expect(fullPrompt).toContain(
        `# Runtime model\nModel ID: ${modelCase.rigModelId}\nProvider ID: claude`,
    );

    const messageText = JSON.stringify(payload.messages);
    expect(messageText).toContain(userPrompt);
    expect(messageText).toContain(RIG_MCP_INSTRUCTIONS);
    expect(messageText).not.toContain("Create settled session metadata");
    expect(payload.tools).toEqual(expectedApiTools(rigTools(modelCase)));
}

function blockedWithoutForwarding(exchange: InterceptedHttpExchange): boolean {
    return (
        exchange.forwardedRequest === undefined &&
        exchange.responseSource === "interceptor" &&
        exchange.response?.status === 400 &&
        Buffer.from(exchange.response.body).toString("utf8").includes(BLOCK_MARKER)
    );
}

function mainInferencePayload(request: InterceptedHttpRequest): AnthropicRequestPayload {
    // The SDK derives metadata.user_id from each process/session. It is not inference content.
    const { metadata: _metadata, ...payload } = requestPayload(request);
    return payload;
}

function requestPayload(request: InterceptedHttpRequest): AnthropicRequestPayload {
    return JSON.parse(Buffer.from(request.body).toString("utf8")) as AnthropicRequestPayload;
}

interface ApiTool {
    description: string;
    input_schema: JsonSchema;
    name: string;
}

interface AnthropicRequestPayload extends Record<string, unknown> {
    messages?: readonly unknown[];
    metadata?: unknown;
    model?: string;
    output_config?: Record<string, unknown>;
    system?: readonly unknown[];
    tools?: readonly ApiTool[];
}

interface ClaudeModelCase {
    name: string;
    rigModelId: string;
    sdkModelId: string;
    profilePrompt: ProfilePrompt;
    profileTools: {
        base: readonly AnyDefinedTool[];
        collaboration: readonly AnyDefinedTool[];
    };
    wireModelId: string;
}

interface JsonSchema extends Record<string, unknown> {
    anyOf?: readonly JsonSchema[];
    const?: unknown;
    description?: string;
    enum?: readonly unknown[];
    items?: JsonSchema;
    properties?: Readonly<Record<string, JsonSchema>>;
    required?: readonly string[];
    type?: string;
}
