import OpenAI from "openai";

import type { CodexCredential } from "@/vendors/VendorCredential.js";

export function createCodexClient(options: {
    credential: CodexCredential;
    endpoint: string;
    sessionId: string;
}): OpenAI {
    const accountId =
        options.credential.name === "codex-session"
            ? options.credential.credential.accountId
            : undefined;
    if (options.credential.name === "codex-session" && accountId === undefined) {
        throw new Error("Codex authentication is missing a ChatGPT account ID.");
    }
    return new OpenAI({
        apiKey:
            options.credential.name === "codex-session"
                ? options.credential.credential.accessToken
                : options.credential.credential.apiKey,
        baseURL:
            options.credential.name === "codex-session"
                ? `${options.endpoint.replace(/\/$/u, "")}/codex`
                : options.endpoint,
        defaultHeaders: {
            ...(accountId === undefined ? {} : { "chatgpt-account-id": accountId }),
            originator: "codex_cli_rs",
            "OpenAI-Beta": "responses=experimental",
            "session-id": options.sessionId,
            "x-client-request-id": options.sessionId,
        },
        maxRetries: 0,
    });
}
