import type {
    ProfilePrompt,
    ProfilePromptContext,
    PromptAsset,
    PromptProvenance,
} from "./types.js";
import { runtimeModelPromptAppend } from "./appends/runtimeModelPromptAppend.js";

export function createProfilePrompt(
    text: string,
    provenance: PromptProvenance,
    render?: (context: ProfilePromptContext) => string,
): ProfilePrompt {
    const original: PromptAsset = {
        text,
        provenance,
        ...(render === undefined ? {} : { render }),
    };
    return { original, patches: [], appends: [runtimeModelPromptAppend] };
}
