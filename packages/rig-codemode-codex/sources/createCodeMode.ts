import { CodeMode } from "./CodeMode.js";
import type { CodeModeOptions } from "./types.js";

export function createCodeMode(options: CodeModeOptions = {}): Promise<CodeMode> {
    return CodeMode.create(options);
}
