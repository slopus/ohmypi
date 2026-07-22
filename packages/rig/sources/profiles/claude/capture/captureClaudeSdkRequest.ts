import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { query } from "@anthropic-ai/claude-agent-sdk";

import { createClaudeCaptureEnvironment } from "./createClaudeCaptureEnvironment.js";
import { createCaptureGitWorktree } from "./createCaptureGitWorktree.js";
import { decodeHttpRequestBody } from "./decodeHttpRequestBody.js";
import { initializeCaptureGitRepository } from "./initializeCaptureGitRepository.js";
import type { ClaudeSdkRequestPayload } from "./types.js";
import { getClaudeOsVersion } from "../getClaudeOsVersion.js";

export async function captureClaudeSdkRequest(
    model: string,
    options: {
        gitRepository?: boolean;
        longProjectPath?: boolean;
        shell?: string;
        worktree?: boolean;
    } = {},
): Promise<{
    captureCwd: string;
    captureHome: string;
    captureIsGitRepository: boolean;
    captureOsVersion: string;
    capturePlatform: NodeJS.Platform;
    captureProjectPath: string;
    captureShell: string | undefined;
    claudeConfigDirectory: string;
    payload: ClaudeSdkRequestPayload;
}> {
    if (options.worktree === true && options.longProjectPath === true) {
        throw new Error("Claude capture worktree and long-path probes must run separately.");
    }
    const captureRoot = await realpath(await mkdtemp(join(tmpdir(), "rig-claude-sdk-profile-")));
    const captureCwd = options.worktree
        ? join(captureRoot, "linked-worktree")
        : options.longProjectPath
          ? join(captureRoot, `long-${"nested-".repeat(30)}`, "workspace")
          : join(captureRoot, "workspace");
    const captureHome = join(captureRoot, "home");
    const claudeConfigDirectory = join(captureRoot, "config");
    await Promise.all(
        [captureHome, claudeConfigDirectory].map((path) => mkdir(path, { recursive: true })),
    );
    let captureProjectPath = captureCwd;
    if (options.worktree === true) {
        captureProjectPath = join(captureRoot, "main-repository");
        await createCaptureGitWorktree(captureProjectPath, captureCwd);
    } else {
        await mkdir(captureCwd, { recursive: true });
    }
    if (options.gitRepository === true && options.worktree !== true) {
        await initializeCaptureGitRepository(captureCwd);
    }
    let resolvePayload: (payload: ClaudeSdkRequestPayload) => void = () => {};
    let rejectPayload: (error: Error) => void = () => {};
    const payloadPromise = new Promise<ClaudeSdkRequestPayload>((resolve, reject) => {
        resolvePayload = resolve;
        rejectPayload = reject;
    });
    const server = createServer(async (request, response) => {
        try {
            const chunks: Buffer[] = [];
            for await (const chunk of request) chunks.push(Buffer.from(chunk));
            const target = new URL(request.url ?? "/", "http://api.anthropic.test");
            if (
                request.method === "POST" &&
                target.hostname === "api.anthropic.test" &&
                target.pathname === "/v1/messages" &&
                target.searchParams.get("beta") === "true"
            ) {
                resolvePayload(
                    JSON.parse(
                        decodeHttpRequestBody(
                            Buffer.concat(chunks),
                            typeof request.headers["content-encoding"] === "string"
                                ? request.headers["content-encoding"]
                                : undefined,
                        ).toString("utf8"),
                    ) as ClaudeSdkRequestPayload,
                );
            }
            response.writeHead(400, { "content-type": "application/json" });
            response.end(
                JSON.stringify({
                    type: "error",
                    error: {
                        type: "invalid_request_error",
                        message: "RIG_CLAUDE_SDK_GOLDEN_CAPTURE_COMPLETE",
                    },
                }),
            );
        } catch (error) {
            rejectPayload(error instanceof Error ? error : new Error(String(error)));
            response.writeHead(500);
            response.end();
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
        throw new Error("Claude SDK capture proxy did not receive a TCP port.");
    }
    const proxyUrl = `http://127.0.0.1:${address.port}`;
    const captureEnvironment = createClaudeCaptureEnvironment({
        captureHome,
        claudeConfigDirectory,
        proxyUrl,
        ...(options.shell === undefined ? {} : { shell: options.shell }),
    });
    const stream = query({
        prompt: "Capture the official Claude Code system prompt and tools.",
        options: {
            cwd: captureCwd,
            env: captureEnvironment,
            maxTurns: 1,
            model,
            permissionMode: "dontAsk",
            persistSession: false,
            settingSources: [],
            skills: [],
            strictMcpConfig: true,
            systemPrompt: {
                type: "preset",
                preset: "claude_code",
            },
            tools: { type: "preset", preset: "claude_code" },
        },
    });

    const drain = (async () => {
        try {
            for await (const _message of stream) {
                // The proxy returns a deliberate error after capturing the request.
            }
        } catch (error) {
            if (!String(error).includes("RIG_CLAUDE_SDK_GOLDEN_CAPTURE_COMPLETE")) throw error;
        }
    })();

    let timeout: NodeJS.Timeout | undefined;
    try {
        const payload = await Promise.race([
            payloadPromise,
            new Promise<never>(
                (_resolve, reject) =>
                    (timeout = setTimeout(
                        () => reject(new Error(`Timed out capturing Claude SDK model '${model}'.`)),
                        30_000,
                    )),
            ),
        ]);
        await drain;
        return {
            captureCwd,
            captureHome,
            captureIsGitRepository: options.gitRepository === true || options.worktree === true,
            captureOsVersion: getClaudeOsVersion(),
            capturePlatform: process.platform,
            captureProjectPath,
            captureShell: captureEnvironment.SHELL,
            claudeConfigDirectory,
            payload,
        };
    } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        stream.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await rm(captureRoot, { force: true, recursive: true });
    }
}
