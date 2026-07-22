import { createProfilePrompt } from "../impl/createProfilePrompt.js";
import type { ProfilePrompt } from "../impl/types.js";
import { codexUltraPromptAppend } from "./appends/codexUltraPromptAppend.js";
import { createCodexPromptProvenance } from "./createPromptProvenance.js";
import { GPT_5_6_SOL_SYSTEM_PROMPT } from "./prompts/gpt56SolSystemPrompt.js";
import { GPT_5_6_TERRA_SYSTEM_PROMPT } from "./prompts/gpt56TerraSystemPrompt.js";

const codexCodeModeTools = ["exec", "wait", "collaboration"] as const;
const codexV1CodeModeTools = [
    "exec",
    "wait",
    "spawn_agent",
    "send_input",
    "resume_agent",
    "wait_agent",
    "close_agent",
] as const;

export const gpt56SolPrompt = createProfilePrompt(
    GPT_5_6_SOL_SYSTEM_PROMPT,
    createCodexPromptProvenance(codexCodeModeTools),
);
export const gpt56TerraPrompt = createProfilePrompt(
    GPT_5_6_TERRA_SYSTEM_PROMPT,
    createCodexPromptProvenance(codexCodeModeTools),
);
export const gpt56LunaPrompt = createProfilePrompt(
    GPT_5_6_TERRA_SYSTEM_PROMPT,
    createCodexPromptProvenance(codexV1CodeModeTools),
);
export const gpt56SolPromptWithUltra: ProfilePrompt = {
    ...gpt56SolPrompt,
    appends: [...gpt56SolPrompt.appends, codexUltraPromptAppend],
};
export const gpt56TerraPromptWithUltra: ProfilePrompt = {
    ...gpt56TerraPrompt,
    appends: [...gpt56TerraPrompt.appends, codexUltraPromptAppend],
};
