import { runtimeModelPromptAppend } from "./appends/runtimeModelPromptAppend.js";
import type { ProfilePrompt } from "./types.js";

export const noCapturedPrompt: ProfilePrompt = {
    patches: [],
    appends: [runtimeModelPromptAppend],
};
