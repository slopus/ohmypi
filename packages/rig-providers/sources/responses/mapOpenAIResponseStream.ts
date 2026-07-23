import type { ResponseStreamEvent } from "openai/resources/responses/responses.js";

import type { SessionEvent } from "@/core/SessionEvent.js";
import { mapGrokResponseStream } from "@/vendors/grok/impl/mapGrokResponseStream.js";

/** Maps the OpenAI Responses event protocol used by Codex, Grok, and Bedrock Mantle. */
export async function* mapOpenAIResponseStream(
    stream: AsyncIterable<ResponseStreamEvent>,
    options: { signal?: AbortSignal; failureMessage: string },
): AsyncGenerator<SessionEvent> {
    yield* mapGrokResponseStream(stream, options);
}
