import { createProfilePrompt } from "../impl/createProfilePrompt.js";
import type { PromptProvenance } from "../impl/types.js";
import { KIMI_SYSTEM_PROMPT } from "./prompts/systemPrompt.js";

const kimiSource: PromptProvenance = {
    client: "Kimi Code",
    version: "unversioned behavior snapshot",
    source: "Moonshot Kimi Code behavior adapted in Rig",
    captureMethod: "Rig-authored adaptation; no byte-identical upstream prompt was captured",
    clientTools: [
        "TaskOutput",
        "Bash",
        "Read",
        "Edit",
        "Write",
        "Glob",
        "Grep",
        "TodoList",
        "FetchURL",
        "WebSearch",
        "TaskStop",
        "AskUserQuestion",
    ],
};

export const kimiPrompt = createProfilePrompt(KIMI_SYSTEM_PROMPT, kimiSource);
