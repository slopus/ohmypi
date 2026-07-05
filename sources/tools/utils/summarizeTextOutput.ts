import { countTextLines } from "./countTextLines.js";
import { singleLineText } from "./singleLineText.js";

export function summarizeTextOutput(text: string, empty = "(no output)"): string {
  const lines = text.split(/\r?\n/u);
  const firstLine = lines.find((line) => line.trim().length > 0);
  if (firstLine === undefined) {
    return empty;
  }

  const lineCount = countTextLines(text);
  const suffix = lineCount > 1 ? ` (+${lineCount - 1} lines)` : "";
  return singleLineText(`${firstLine}${suffix}`);
}
