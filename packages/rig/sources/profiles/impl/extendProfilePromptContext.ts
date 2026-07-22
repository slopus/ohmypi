import type { Provider } from "../../providers/types.js";
import type { ProfilePromptContext } from "./types.js";

export async function extendProfilePromptContext(
    provider: Provider,
    context: ProfilePromptContext,
): Promise<ProfilePromptContext> {
    return provider.extendProfilePromptContext?.(context) ?? context;
}
