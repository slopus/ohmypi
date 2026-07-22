import { renderRuntimeModelPromptAppend } from "../renderRuntimeModelPromptAppend.js";
import type { ProfilePromptAppend } from "../types.js";

export const runtimeModelPromptAppend: ProfilePromptAppend = {
    id: "rig-runtime-model",
    description:
        "Rig appends the selected model and configured provider identity to every assembled prompt.",
    render: renderRuntimeModelPromptAppend,
};
