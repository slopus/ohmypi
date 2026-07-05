import { Type, type Static } from "@sinclair/typebox";

import type { ContentBlock } from "../../agent/types.js";
import { defineTool } from "../../agent/types.js";
import { singleLineText } from "./singleLineText.js";

export const textOutputSchema = Type.Object({
    text: Type.String(),
});

export type TextOutput = Static<typeof textOutputSchema>;

export function toTextBlocks(result: TextOutput): readonly ContentBlock[] {
    return [{ type: "text", text: result.text }];
}

export function createStubTool(name: string, description: string) {
    return defineTool({
        name,
        label: name,
        description,
        arguments: Type.Object({}),
        returnType: textOutputSchema,
        execute() {
            return { text: `${name} is declared but requires host application state.` };
        },
        toLLM: toTextBlocks,
        toUI: (result) => singleLineText(result.text),
        locks: [],
    });
}
