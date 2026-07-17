import { Type, type Static } from "@sinclair/typebox";

import type { ContentBlock } from "../../agent/types.js";

export const textOutputSchema = Type.Object({
    text: Type.String(),
});

export type TextOutput = Static<typeof textOutputSchema>;

export function toTextBlocks(result: TextOutput): readonly ContentBlock[] {
    return [{ type: "text", text: result.text }];
}
