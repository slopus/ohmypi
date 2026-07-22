import { CODEX_ULTRA_INSTRUCTIONS } from "../codex/appends/codexUltraInstructions.js";
import type { ProfilePromptAppendContext } from "./types.js";

export function renderCodexUltraPromptAppend(
    context: ProfilePromptAppendContext,
): string | undefined {
    return context.effort === "ultra" ? CODEX_ULTRA_INSTRUCTIONS : undefined;
}
