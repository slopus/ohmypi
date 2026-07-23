#!/usr/bin/env node

import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

const outputArgument = process.argv[2];
const transport = process.argv[3] ?? "sse";
const initialModel = process.argv[4] ?? "gpt-5.6-sol";
const switchedModel = process.argv[5] ?? "gpt-5.6-terra";
const supportedModels = new Set(["gpt-5.5", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
if (outputArgument === undefined)
    throw new Error(
        "Usage: node captureCodexMultiTurnTrace.mjs <output.json> " +
            "[sse|websocket] [initial-model] [switched-model]",
    );
if (transport !== "sse" && transport !== "websocket")
    throw new Error(`Unsupported transport '${transport}'.`);
if (!supportedModels.has(initialModel) || !supportedModels.has(switchedModel))
    throw new Error(`Unsupported model switch '${initialModel}' -> '${switchedModel}'.`);

const outputPath = resolve(outputArgument);
const captureDirectory = await mkdtemp(`${tmpdir()}/rig-codex-multiturn-sse-`);
const isolatedCodexHome = join(captureDirectory, "codex-home");
await mkdir(isolatedCodexHome);
await copyFile(
    join(process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "auth.json"),
    join(isolatedCodexHome, "auth.json"),
);
await copyFile(
    join(process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "models_cache.json"),
    join(isolatedCodexHome, "models_cache.json"),
);

const requests = [];
const server = createServer(async (request, response) => {
    if (request.method !== "POST") {
        response.writeHead(404).end();
        return;
    }
    const body = JSON.parse(await readBody(request));
    requests.push(normalizeRequest(body, captureDirectory));
    const index = requests.length;
    response.writeHead(200, { "content-type": "text/event-stream" });
    const item = assistantItem(index, body);
    response.end(
        `data: ${JSON.stringify({ type: "response.output_item.done", item })}\n\n` +
            `data: ${JSON.stringify(completedResponse(index, item))}\n\ndata: [DONE]\n\n`,
    );
});
server.on("upgrade", (request, socket) => {
    if (transport !== "websocket") {
        socket.destroy();
        return;
    }
    acceptWebSocket(request, socket);
    const frames = createFrameReader(socket);
    void (async () => {
        for (;;) {
            const body = JSON.parse(await frames.next());
            requests.push(normalizeRequest(body, captureDirectory));
            const index = requests.length;
            if (body.generate === false) {
                socket.write(
                    encodeTextFrame(
                        JSON.stringify({
                            type: "response.completed",
                            response: {
                                id: `resp-capture-${index}`,
                                output: [],
                                usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
                            },
                        }),
                    ),
                );
                continue;
            }
            const item = assistantItem(index, body);
            socket.write(
                encodeTextFrame(
                    JSON.stringify({ type: "response.output_item.done", item }),
                ),
            );
            socket.write(encodeTextFrame(JSON.stringify(completedResponse(index, item))));
        }
    })().catch(() => socket.destroy());
});
server.listen(0, "127.0.0.1");
const port = await listeningPort(server);

const codex = spawn(
    "codex",
    [
        "app-server",
        "--stdio",
        "--config",
        'model_provider="capture"',
        "--config",
        `model="${initialModel}"`,
        "--config",
        'model_reasoning_effort="low"',
        "--config",
        `model_providers.capture={name="Rig multi-turn capture",base_url="http://127.0.0.1:${port}/v1",wire_api="responses",requires_openai_auth=true,supports_websockets=${transport === "websocket"}}`,
    ],
    {
        env: {
            CODEX_HOME: isolatedCodexHome,
            HOME: homedir(),
            LANG: process.env.LANG ?? "en_US.UTF-8",
            PATH: process.env.PATH,
            TMPDIR: tmpdir(),
        },
        stdio: ["pipe", "pipe", "pipe"],
    },
);

const pending = new Map();
const notifications = [];
let nextId = 1;
let stderr = "";
codex.stderr.setEncoding("utf8");
codex.stderr.on("data", (chunk) => {
    stderr += chunk;
});
createInterface({ input: codex.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    if (message.id !== undefined && pending.has(message.id)) {
        const { resolve: resolveResponse, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error === undefined) resolveResponse(message.result);
        else reject(new Error(JSON.stringify(message.error)));
        return;
    }
    if (message.method !== undefined) {
        notifications.push(message);
        flushNotificationWaiters();
    }
});

const notificationWaiters = [];

try {
    await rpc("initialize", {
        clientInfo: { name: "rig_trace_capture", title: "Rig trace capture", version: "1" },
        capabilities: { experimentalApi: true },
    });
    notify("initialized");
    const started = await rpc("thread/start", {
        model: initialModel,
        effort: "low",
        cwd: captureDirectory,
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: true,
    });
    const threadId = started.thread.id;
    await runTurn(threadId, "First turn. Reply with exactly FIRST.");
    await runTurn(threadId, "Second turn. Reply with exactly SECOND.");
    await rpc("thread/compact/start", { threadId });
    await waitForNotification(
        (message) =>
            message.method === "item/completed" &&
            message.params?.item?.type === "contextCompaction",
    );
    await waitForNotification(
        (message) =>
            message.method === "turn/completed" && message.params?.threadId === threadId,
    );
    await runTurn(threadId, "After compaction. Reply with exactly SWITCHED.", switchedModel);

    await writeFile(
        outputPath,
        `${JSON.stringify(
            {
                formatVersion: 1,
                source: {
                    client: "codex-app-server",
                    version: await codexVersion(),
                    transport,
                },
                scenario: {
                    initialModel,
                    switchedModel,
                    actions: ["turn", "turn", "compact", "turn"],
                },
                requests,
            },
            null,
            2,
        )}\n`,
        "utf8",
    );
    process.stdout.write(`Captured ${requests.length} ${transport} requests to ${outputPath}\n`);
} catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${stderr}`);
} finally {
    codex.kill("SIGTERM");
    server.close();
    await rm(captureDirectory, { force: true, recursive: true });
}

function rpc(method, params) {
    const id = nextId++;
    codex.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    return new Promise((resolveResponse, reject) => {
        pending.set(id, { resolve: resolveResponse, reject });
    });
}

function notify(method, params = {}) {
    codex.stdin.write(`${JSON.stringify({ method, params })}\n`);
}

async function runTurn(threadId, text, model) {
    const result = await rpc("turn/start", {
        threadId,
        input: [{ type: "text", text }],
        ...(model === undefined ? {} : { model }),
    });
    await waitForNotification(
        (message) =>
            message.method === "turn/completed" &&
            message.params?.threadId === threadId &&
            message.params?.turn?.id === result.turn.id,
    );
}

function waitForNotification(predicate) {
    const existingIndex = notifications.findIndex(predicate);
    if (existingIndex >= 0) return Promise.resolve(notifications.splice(existingIndex, 1)[0]);
    return new Promise((resolveNotification) => {
        notificationWaiters.push({ predicate, resolve: resolveNotification });
    });
}

function flushNotificationWaiters() {
    for (let waiterIndex = notificationWaiters.length - 1; waiterIndex >= 0; waiterIndex -= 1) {
        const waiter = notificationWaiters[waiterIndex];
        const messageIndex = notifications.findIndex(waiter.predicate);
        if (messageIndex < 0) continue;
        notificationWaiters.splice(waiterIndex, 1);
        waiter.resolve(notifications.splice(messageIndex, 1)[0]);
    }
}

function assistantItem(index, request) {
    const compaction = JSON.stringify(request.input ?? []).includes(
        "CONTEXT CHECKPOINT COMPACTION",
    );
    return {
        id: `msg-capture-${index}`,
        type: "message",
        role: "assistant",
        content: [
            {
                type: "output_text",
                text: compaction ? "A compact summary." : `RESPONSE_${index}`,
            },
        ],
    };
}

function completedResponse(index, item) {
    return {
        type: "response.completed",
        response: {
            id: `resp-capture-${index}`,
            output: [item],
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        },
    };
}

function normalizeRequest(request, temporaryDirectory) {
    const normalized = structuredClone(request);
    if ("prompt_cache_key" in normalized) normalized.prompt_cache_key = "<SESSION_ID>";
    delete normalized.client_metadata;
    return JSON.parse(
        JSON.stringify(normalized)
            .replaceAll(temporaryDirectory, "<CAPTURE_DIRECTORY>")
            .replaceAll(homedir(), "<HOME>")
            .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu, "<UUID>"),
    );
}

function readBody(request) {
    return new Promise((resolveBody, reject) => {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            body += chunk;
        });
        request.once("end", () => resolveBody(body));
        request.once("error", reject);
    });
}

function listeningPort(httpServer) {
    return new Promise((resolvePort, reject) => {
        httpServer.once("listening", () => {
            const address = httpServer.address();
            if (typeof address !== "object" || address === null)
                reject(new Error("Capture server did not bind a port."));
            else resolvePort(address.port);
        });
        httpServer.once("error", reject);
    });
}

function codexVersion() {
    return new Promise((resolveVersion, reject) => {
        const child = spawn("codex", ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.once("error", reject);
        child.once("close", (code) =>
            code === 0
                ? resolveVersion(stdout.trim())
                : reject(new Error(`codex --version exited with ${code}.`)),
        );
    });
}

function acceptWebSocket(request, socket) {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") throw new Error("Missing WebSocket key.");
    import("node:crypto").then(({ createHash }) => {
        const accept = createHash("sha1")
            .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
            .digest("base64");
        socket.write(
            "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
        );
    });
}

function createFrameReader(socket) {
    let buffer = Buffer.alloc(0);
    const waiting = [];
    const values = [];
    socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
            const frame = takeFrame(buffer);
            if (frame === undefined) break;
            buffer = buffer.subarray(frame.consumed);
            const waiter = waiting.shift();
            if (waiter === undefined) values.push(frame.text);
            else waiter(frame.text);
        }
    });
    return {
        next: () =>
            values.length > 0
                ? Promise.resolve(values.shift())
                : new Promise((resolveFrame) => waiting.push(resolveFrame)),
    };
}

function takeFrame(buffer) {
    if (buffer.length < 2) return undefined;
    let length = buffer[1] & 0x7f;
    let offset = 2;
    if (length === 126) {
        if (buffer.length < 4) return undefined;
        length = buffer.readUInt16BE(2);
        offset = 4;
    } else if (length === 127) {
        if (buffer.length < 10) return undefined;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
    }
    const masked = (buffer[1] & 0x80) !== 0;
    const maskLength = masked ? 4 : 0;
    if (buffer.length < offset + maskLength + length) return undefined;
    const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
    const payloadOffset = offset + maskLength;
    const payload = Buffer.from(buffer.subarray(payloadOffset, payloadOffset + length));
    if (mask !== undefined)
        for (let index = 0; index < payload.length; index += 1)
            payload[index] ^= mask[index % 4];
    return { consumed: payloadOffset + length, text: payload.toString("utf8") };
}

function encodeTextFrame(value) {
    const payload = Buffer.from(value, "utf8");
    if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
}
