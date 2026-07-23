import { codexValuesEqual } from "@/vendors/codex/impl/codexValuesEqual.js";

const REUSED_PROPERTIES = [
    "model",
    "instructions",
    "tools",
    "tool_choice",
    "parallel_tool_calls",
    "reasoning",
    "store",
    "stream",
    "include",
    "service_tier",
    "prompt_cache_key",
    "text",
] as const;

/** Matches the exhaustive non-input reuse check in the Codex websocket client. */
export function codexRequestPropertiesMatch(
    previous: Record<string, unknown>,
    current: Record<string, unknown>,
): boolean {
    return REUSED_PROPERTIES.every((property) =>
        codexValuesEqual(previous[property], current[property]),
    );
}
