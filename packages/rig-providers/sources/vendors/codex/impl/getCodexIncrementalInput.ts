import { codexValuesEqual } from "@/vendors/codex/impl/codexValuesEqual.js";
import { codexRequestPropertiesMatch } from "@/vendors/codex/impl/codexRequestPropertiesMatch.js";

/** Returns the wire-input suffix reusable with the last response ID, or undefined. */
export function getCodexIncrementalInput(
    previousRequest: Record<string, unknown>,
    responseItems: readonly unknown[],
    currentRequest: Record<string, unknown>,
): readonly unknown[] | undefined {
    if (!codexRequestPropertiesMatch(previousRequest, currentRequest)) return undefined;
    const previousInput = Array.isArray(previousRequest.input) ? previousRequest.input : [];
    const currentInput = Array.isArray(currentRequest.input) ? currentRequest.input : [];
    const expectedPrefix = [...previousInput, ...responseItems].map(clearIgnoredMetadata);
    if (currentInput.length < expectedPrefix.length) return undefined;
    const actualPrefix = currentInput.slice(0, expectedPrefix.length).map(clearIgnoredMetadata);
    if (!codexValuesEqual(expectedPrefix, actualPrefix)) return undefined;
    return currentInput.slice(expectedPrefix.length);
}

function clearIgnoredMetadata(value: unknown): unknown {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    const copy = structuredClone(value) as Record<string, unknown>;
    delete copy.internal_chat_message_metadata_passthrough;
    return copy;
}
