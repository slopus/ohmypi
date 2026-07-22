import { createProfilePrompt } from "../impl/createProfilePrompt.js";
import type { PromptProvenance } from "../impl/types.js";
import { GROK_BUILD_SYSTEM_PROMPT } from "./prompts/systemPrompt.js";

const grokSource: PromptProvenance = {
    client: "xai-org/grok-build",
    version: "unversioned source snapshot",
    source: "xai-org/grok-build, adapted for Rig's shared runtime",
    captureMethod: "Adapted source prompt; upstream commit was not recorded",
    clientTools: [
        "run_terminal_command",
        "read_file",
        "search_replace",
        "list_dir",
        "grep",
        "get_command_or_subagent_output",
        "kill_command_or_subagent",
    ],
};

export const grokPrompt = createProfilePrompt(GROK_BUILD_SYSTEM_PROMPT, grokSource);
