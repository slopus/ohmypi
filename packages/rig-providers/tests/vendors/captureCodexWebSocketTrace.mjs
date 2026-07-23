#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SUPPORTED_MODELS = new Set(["gpt-5.5", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
const REASONING_EFFORT = "low";
const PROMPT = "Reply with OK.";
const CAPTURE_TIMEOUT_MS = 30_000;

const outputArgument = process.argv[2];
const modelArgument = process.argv[3];
if (outputArgument === undefined || modelArgument === undefined) {
    throw new Error("Usage: node captureCodexWebSocketTrace.mjs <output.json> <model>");
}
if (!SUPPORTED_MODELS.has(modelArgument)) {
    throw new Error(`Unsupported capture model '${modelArgument}'.`);
}
const model = modelArgument;

const outputPath = resolve(outputArgument);
const captureDirectory = await mkdtemp(`${tmpdir()}/rig-codex-websocket-capture-`);
const isolatedCodexHome = join(captureDirectory, "codex-home");
await mkdir(isolatedCodexHome);
await copyFile(
    join(process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "auth.json"),
    join(isolatedCodexHome, "auth.json"),
);
const server = createServer();
server.listen(0, "127.0.0.1");
const port = await listeningPort(server);

let captured = false;
let resolveCapture;
let rejectCapture;
const capture = new Promise((resolvePromise, rejectPromise) => {
    resolveCapture = resolvePromise;
    rejectCapture = rejectPromise;
});

server.on("upgrade", (request, socket) => {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") {
        rejectCapture(new Error("Codex WebSocket handshake omitted sec-websocket-key."));
        socket.destroy();
        return;
    }
    const accept = createHash("sha1")
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest("base64");
    socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    readInferenceRequest(socket).then(async ({ frame, warmup }) => {
        try {
            const trace = {
                formatVersion: 1,
                source: {
                    client: "codex-cli",
                    version: await codexVersion(),
                    transport: "websocket",
                },
                invocation: {
                    model,
                    reasoningEffort: REASONING_EFFORT,
                    prompt: PROMPT,
                },
                handshake: {
                    method: request.method,
                    path: request.url,
                    headers: sanitizeHeaders(request.headers),
                },
                warmup,
                request: frame,
            };
            await writeFile(
                outputPath,
                `${JSON.stringify(normalizeTrace(trace, captureDirectory), null, 2)}\n`,
                "utf8",
            );
            await writeFile(
                toolsOutputPath(outputPath),
                `${JSON.stringify(extractToolDefinitions(trace), null, 2)}\n`,
                "utf8",
            );
            captured = true;
            resolveCapture();
            socket.write(
                encodeTextFrame(
                    JSON.stringify({
                        type: "error",
                        code: "capture_complete",
                        message: "Codex WebSocket request captured.",
                        param: null,
                        sequence_number: 0,
                    }),
                ),
            );
            socket.end();
        } catch (error) {
            rejectCapture(error);
        }
    }, rejectCapture);
});
server.on("error", rejectCapture);

const codex = spawn(
    "codex",
    [
        "exec",
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "--skip-git-repo-check",
        "--json",
        "--cd",
        captureDirectory,
        "--model",
        model,
        "--config",
        'model_provider="capture"',
        "--config",
        `model_reasoning_effort="${REASONING_EFFORT}"`,
        "--config",
        `model_providers.capture={name="Rig WebSocket capture",base_url="http://127.0.0.1:${port}/v1",wire_api="responses",requires_openai_auth=true,supports_websockets=true}`,
        PROMPT,
    ],
    {
        env: {
            CODEX_HOME: isolatedCodexHome,
            HOME: homedir(),
            LANG: process.env.LANG ?? "en_US.UTF-8",
            PATH: process.env.PATH,
            TMPDIR: tmpdir(),
        },
        stdio: ["ignore", "ignore", "pipe"],
    },
);

let stderr = "";
codex.stderr.setEncoding("utf8");
codex.stderr.on("data", (chunk) => {
    stderr += chunk;
});
codex.on("error", rejectCapture);

const timeout = setTimeout(() => {
    rejectCapture(
        new Error(`Codex did not send a WebSocket request within ${CAPTURE_TIMEOUT_MS}ms.`),
    );
}, CAPTURE_TIMEOUT_MS);

try {
    await capture;
    process.stdout.write(
        `Captured ${model} ${REASONING_EFFORT} WebSocket request to ${outputPath}\n` +
            `Wrote tool definitions to ${toolsOutputPath(outputPath)}\n`,
    );
} catch (error) {
    throw new Error(
        `${error instanceof Error ? error.message : String(error)}${stderr ? `\n${stderr}` : ""}`,
    );
} finally {
    clearTimeout(timeout);
    if (!captured && codex.exitCode === null) codex.kill("SIGTERM");
    server.close();
    await rm(captureDirectory, { force: true, recursive: true });
}

function listeningPort(httpServer) {
    return new Promise((resolvePromise, rejectPromise) => {
        httpServer.once("listening", () => {
            const address = httpServer.address();
            if (typeof address !== "object" || address === null) {
                rejectPromise(new Error("WebSocket capture server did not bind a TCP port."));
                return;
            }
            resolvePromise(address.port);
        });
        httpServer.once("error", rejectPromise);
    });
}

function readFirstTextFrame(socket) {
    return new Promise((resolvePromise, rejectPromise) => {
        let buffered = Buffer.alloc(0);
        socket.on("data", (chunk) => {
            buffered = Buffer.concat([buffered, chunk]);
            if (buffered.length < 2) return;
            const masked = (buffered[1] & 0x80) !== 0;
            let length = buffered[1] & 0x7f;
            let offset = 2;
            if (length === 126) {
                if (buffered.length < 4) return;
                length = buffered.readUInt16BE(2);
                offset = 4;
            } else if (length === 127) {
                if (buffered.length < 10) return;
                const largeLength = buffered.readBigUInt64BE(2);
                if (largeLength > BigInt(Number.MAX_SAFE_INTEGER)) {
                    rejectPromise(new Error("Codex WebSocket frame is too large to capture."));
                    return;
                }
                length = Number(largeLength);
                offset = 10;
            }
            const maskLength = masked ? 4 : 0;
            if (buffered.length < offset + maskLength + length) return;
            const mask = masked ? buffered.subarray(offset, offset + 4) : undefined;
            const payloadOffset = offset + maskLength;
            const payload = Buffer.from(buffered.subarray(payloadOffset, payloadOffset + length));
            if (mask !== undefined) {
                for (let index = 0; index < payload.length; index += 1) {
                    payload[index] ^= mask[index % 4];
                }
            }
            resolvePromise(payload.toString("utf8"));
        });
        socket.once("error", rejectPromise);
        socket.once("end", () =>
            rejectPromise(new Error("Codex closed before sending a WebSocket frame.")),
        );
    });
}

async function readInferenceRequest(socket) {
    const first = JSON.parse(await readFirstTextFrame(socket));
    if (first.generate !== false) return { frame: first, warmup: null };

    socket.write(
        encodeTextFrame(
            JSON.stringify({ type: "response.created", response: { id: "resp-capture-warmup" } }),
        ),
    );
    socket.write(
        encodeTextFrame(
            JSON.stringify({
                type: "response.completed",
                response: {
                    id: "resp-capture-warmup",
                    usage: {
                        input_tokens: 0,
                        input_tokens_details: null,
                        output_tokens: 0,
                        output_tokens_details: null,
                        total_tokens: 0,
                    },
                },
            }),
        ),
    );
    return { frame: JSON.parse(await readFirstTextFrame(socket)), warmup: first };
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

async function codexVersion() {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn("codex", ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.once("error", rejectPromise);
        child.once("close", (code) => {
            if (code !== 0) rejectPromise(new Error(`codex --version exited with ${code}.`));
            else resolvePromise(stdout.trim());
        });
    });
}

function sanitizeHeaders(headers) {
    const stableHeaders = new Set([
        "connection",
        "openai-beta",
        "originator",
        "sec-websocket-extensions",
        "sec-websocket-version",
        "upgrade",
        "x-codex-beta-features",
    ]);
    const sanitized = {};
    for (const [name, value] of Object.entries(headers)) {
        if (value === undefined || !stableHeaders.has(name.toLowerCase())) continue;
        sanitized[name] = value;
    }
    return sanitized;
}

function normalizeTrace(trace, temporaryDirectory) {
    const normalized = structuredClone(trace);
    normalizeRequest(normalized.warmup, temporaryDirectory);
    normalizeRequest(normalized.request, temporaryDirectory);
    return normalized;
}

function normalizeRequest(request, temporaryDirectory) {
    if (request === null || typeof request !== "object") return;
    if ("prompt_cache_key" in request) request.prompt_cache_key = "<SESSION_ID>";
    if ("previous_response_id" in request) request.previous_response_id = "<PREVIOUS_RESPONSE_ID>";
    if (request.client_metadata !== undefined) {
        request.client_metadata = Object.fromEntries(
            Object.keys(request.client_metadata).map((key) => [key, `<DYNAMIC:${key}>`]),
        );
    }
    if (!Array.isArray(request.input)) return;
    for (const item of request.input) {
        if (item?.type !== "message" || !Array.isArray(item.content)) continue;
        for (const content of item.content) {
            if (content?.type !== "input_text" || content.text === PROMPT) continue;
            content.text = content.text
                .replaceAll(temporaryDirectory, "<CAPTURE_DIRECTORY>")
                .replaceAll(homedir(), "<HOME>")
                .replace(
                    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu,
                    "<UUID>",
                );
        }
    }
}

function extractToolDefinitions(trace) {
    const additionalTools = trace.warmup?.input?.find(
        (item) => item?.type === "additional_tools",
    );
    if (Array.isArray(additionalTools?.tools)) return additionalTools.tools;
    if (Array.isArray(trace.request?.tools)) return trace.request.tools;
    throw new Error("Codex request did not contain tool definitions.");
}

function toolsOutputPath(traceOutputPath) {
    return traceOutputPath.endsWith(".websocket.json")
        ? traceOutputPath.replace(/\.websocket\.json$/u, ".tools.json")
        : `${traceOutputPath}.tools.json`;
}
