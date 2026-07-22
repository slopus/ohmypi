import type { ProfilePrompt } from "./types.js";

export function withoutProfilePromptAppend(prompt: ProfilePrompt, appendId: string): ProfilePrompt {
    return {
        ...prompt,
        appends: prompt.appends.filter((append) => append.id !== appendId),
    };
}
