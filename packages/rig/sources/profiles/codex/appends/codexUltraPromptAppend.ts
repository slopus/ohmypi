import { renderCodexUltraPromptAppend } from "../../impl/renderCodexUltraPromptAppend.js";
import type { ProfilePromptAppend } from "../../impl/types.js";

export const codexUltraPromptAppend: ProfilePromptAppend = {
    id: "codex-ultra-multi-agent",
    description: "Rig maps Ultra to max reasoning and appends proactive multi-agent instructions.",
    includeWithSystemPromptOverride: true,
    render: renderCodexUltraPromptAppend,
};
