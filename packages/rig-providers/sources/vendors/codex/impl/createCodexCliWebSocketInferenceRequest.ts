import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js";

import { isCodexV2Model } from "@/vendors/codex/impl/isCodexV2Model.js";

export function createCodexCliWebSocketInferenceRequest(
    request: ResponseCreateParamsStreaming,
): ResponseCreateParamsStreaming {
    if (!isCodexV2Model(String(request.model))) return request;
    const inference = structuredClone(request);
    const input = inference.input as unknown[];
    const instructionIndex = input.findIndex(
        (item) =>
            typeof item === "object" &&
            item !== null &&
            (item as { role?: unknown }).role === "developer",
    );
    if (instructionIndex >= 0) input.splice(instructionIndex, 1);
    return inference;
}
