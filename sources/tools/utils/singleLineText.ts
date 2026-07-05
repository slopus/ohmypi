export function singleLineText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
