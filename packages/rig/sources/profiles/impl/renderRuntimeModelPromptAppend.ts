import type { ProfilePromptAppendContext } from "./types.js";

export function renderRuntimeModelPromptAppend(context: ProfilePromptAppendContext): string {
    return `# Runtime model\nModel ID: ${context.modelId}\nProvider ID: ${context.providerId}`;
}
