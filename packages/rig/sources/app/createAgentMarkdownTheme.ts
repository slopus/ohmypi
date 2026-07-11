import type { MarkdownTheme } from "@earendil-works/pi-tui";

import { highlightAgentCode } from "./highlightAgentCode.js";

const FG_RESET = "\x1b[39m";
const BOLD = "\x1b[1m";
const NOT_BOLD = "\x1b[22m";
const ITALIC = "\x1b[3m";
const NOT_ITALIC = "\x1b[23m";
const STRIKETHROUGH = "\x1b[9m";
const NOT_STRIKETHROUGH = "\x1b[29m";
const UNDERLINE = "\x1b[4m";
const NOT_UNDERLINE = "\x1b[24m";

const MD_HEADING = [240, 198, 116] as const;
const MD_LINK = [129, 162, 190] as const;
const MD_LINK_URL = [102, 102, 102] as const;
const MD_CODE = [138, 190, 183] as const;
const MD_CODE_BLOCK = [181, 189, 104] as const;
const MD_MUTED = [128, 128, 128] as const;

export function createAgentMarkdownTheme(): MarkdownTheme {
    return {
        heading: (text) => fg(MD_HEADING, text),
        link: (text) => fg(MD_LINK, text),
        linkUrl: (text) => fg(MD_LINK_URL, text),
        code: (text) => fg(MD_CODE, text),
        codeBlock: (text) => fg(MD_CODE_BLOCK, text),
        codeBlockBorder: (text) => fg(MD_MUTED, text),
        quote: (text) => fg(MD_MUTED, text),
        quoteBorder: (text) => fg(MD_MUTED, text),
        hr: (text) => fg(MD_MUTED, text),
        listBullet: (text) => fg(MD_CODE, text),
        bold: (text) => `${BOLD}${text}${NOT_BOLD}`,
        italic: (text) => `${ITALIC}${text}${NOT_ITALIC}`,
        strikethrough: (text) => `${STRIKETHROUGH}${text}${NOT_STRIKETHROUGH}`,
        underline: (text) => `${UNDERLINE}${text}${NOT_UNDERLINE}`,
        highlightCode: highlightAgentCode,
        codeBlockIndent: "  ",
    };
}

function fg(color: readonly [number, number, number], text: string): string {
    return `\x1b[38;2;${color[0]};${color[1]};${color[2]}m${text}${FG_RESET}`;
}
