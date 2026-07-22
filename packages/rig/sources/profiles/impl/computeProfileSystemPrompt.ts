import { runtimeModelPromptAppend } from "./appends/runtimeModelPromptAppend.js";
import type { ModelProfile, ProfilePromptAppendContext } from "./types.js";

export function computeProfileSystemPrompt(
    profile: ModelProfile | undefined,
    context: ProfilePromptAppendContext,
    options: { originalOverride?: string } = {},
): string {
    const original = profile?.prompt.original;
    let prompt = options.originalOverride ?? original?.render?.(context) ?? original?.text ?? "";
    const patches = options.originalOverride === undefined ? (profile?.prompt.patches ?? []) : [];
    for (const patch of patches) {
        if (!prompt.includes(patch.find)) {
            throw new Error(`Prompt patch '${patch.id}' did not match profile '${profile?.id}'.`);
        }
        prompt = prompt.replace(patch.find, patch.replace);
    }

    const appends = (profile?.prompt.appends ?? [runtimeModelPromptAppend]).filter(
        (append) =>
            options.originalOverride === undefined ||
            append.includeWithSystemPromptOverride === true,
    );
    const parts = [prompt, ...appends.map((append) => append.render(context) ?? "")].filter(
        (part) => part.length > 0,
    );
    return parts.join("\n\n");
}
