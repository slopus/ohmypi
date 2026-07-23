import type { ProviderModality } from "@/core/ProviderModality.js";
import type { SessionOptions } from "@/core/SessionOptions.js";
import { ResponsesProvider } from "@/responses/ResponsesProvider.js";
import type { CodexCredential } from "@/vendors/VendorCredential.js";
import { CodexSession } from "@/vendors/codex/CodexSession.js";
import { assertCodexCredential } from "@/vendors/codex/impl/assertCodexCredential.js";
import {
    CODEX_API_ENDPOINT,
    CODEX_CHATGPT_ENDPOINT,
    type CodexTransport,
} from "@/vendors/codex/impl/codexConstants.js";

export interface CodexProviderOptions {
    credential: CodexCredential;
    endpoint?: string;
    model?: string;
    transport?: CodexTransport;
}

export class CodexProvider extends ResponsesProvider {
    static override readonly name = "codex";
    static override readonly inputTypes: readonly ProviderModality[] = ["text"];
    static override readonly outputTypes: readonly ProviderModality[] = ["text"];

    readonly credential: CodexCredential;
    readonly endpoint: string;
    readonly model: string | undefined;
    readonly transport: CodexTransport;

    constructor(options: CodexProviderOptions) {
        super();
        assertCodexCredential(options.credential);
        this.credential = options.credential;
        this.endpoint =
            options.endpoint ??
            (options.credential.name === "codex-session"
                ? CODEX_CHATGPT_ENDPOINT
                : CODEX_API_ENDPOINT);
        this.model = options.model;
        this.transport = options.transport ?? "auto";
    }

    override async session(id: string, options: SessionOptions): Promise<CodexSession> {
        return new CodexSession(id, {
            ...options,
            credential: this.credential,
            endpoint: this.endpoint,
            ...(this.model === undefined ? {} : { model: this.model }),
            transport: this.transport,
        });
    }
}
