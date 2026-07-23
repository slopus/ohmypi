import { BaseProvider } from "@/core/BaseProvider.js";
import type { BaseSession } from "@/core/BaseSession.js";
import type { ProviderModality } from "@/core/ProviderModality.js";
import type { SessionOptions } from "@/core/SessionOptions.js";
import { ResponsesSession } from "@/responses/ResponsesSession.js";

export class ResponsesProvider extends BaseProvider {
    static override readonly name: string = "responses";
    static override readonly inputTypes: readonly ProviderModality[] = ["text"];
    static override readonly outputTypes: readonly ProviderModality[] = ["text"];

    async session(id: string, options: SessionOptions): Promise<BaseSession> {
        return new ResponsesSession(id, options);
    }
}
