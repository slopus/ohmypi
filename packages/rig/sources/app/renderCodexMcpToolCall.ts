import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

import type {
    CodexMcpToolCall,
    CodexMcpToolPalette,
    CodexMcpToolRenderOptions,
} from "./CodexMcpToolCall.js";
import { DEFAULT_CODEX_MCP_TOOL_PALETTE } from "./CodexMcpToolCall.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const NOT_BOLD_OR_DIM = "\x1b[22m";
const DEFAULT_MAX_REVIEW_ROWS = 3;
const DEFAULT_MAX_RESULT_ROWS = 5;
const MINIMUM_WRAPPED_WIDTH = 20;

interface InvocationLayout {
    readonly argumentsEnd: number;
    readonly argumentsStart: number;
    readonly plain: string;
    readonly serverEnd: number;
    readonly toolEnd: number;
    readonly toolStart: number;
}

interface WrappedSegment {
    readonly start: number;
    readonly text: string;
}

interface TextToken {
    readonly end: number;
    readonly start: number;
    readonly text: string;
    readonly whitespace: boolean;
    readonly width: number;
}

export function renderCodexMcpToolCall(
    call: CodexMcpToolCall,
    options: CodexMcpToolRenderOptions,
): string[] {
    const width = Math.max(1, Math.floor(options.width));
    const maxReviewRows = Math.max(0, Math.floor(options.maxReviewRows ?? DEFAULT_MAX_REVIEW_ROWS));
    const maxResultRows = Math.max(0, Math.floor(options.maxResultRows ?? DEFAULT_MAX_RESULT_ROWS));
    const palette = options.palette ?? DEFAULT_CODEX_MCP_TOOL_PALETTE;
    const invocation = invocationLayout(call);
    const header = renderHeader(call.status, palette);
    if (width < MINIMUM_WRAPPED_WIDTH) {
        return renderNarrowCall(call, invocation, header, palette, width, {
            maxReviewRows,
            maxResultRows,
        });
    }
    const inline = visibleWidth(invocation.plain) <= Math.max(0, width - visibleWidth(header) - 1);
    const lines: string[] = [];

    if (inline) {
        lines.push(
            `${header} ${renderInvocationSegment(invocation, 0, invocation.plain, palette)}`,
        );
    } else {
        lines.push(header);
        const wrappedInvocation = wrapWithHangingIndent(
            invocation.plain,
            Math.max(1, width - 4),
            Math.max(1, width - 8),
        );
        for (const [index, segment] of wrappedInvocation.entries()) {
            const prefix = index === 0 ? `${DIM}  └ ${NOT_BOLD_OR_DIM}` : "        ";
            lines.push(
                `${prefix}${renderInvocationSegment(invocation, segment.start, segment.text, palette)}`,
            );
        }
    }

    const reviewLines = renderResultLines(call.review, Math.max(1, width - 4), maxReviewRows);
    for (const [index, reviewLine] of reviewLines.entries()) {
        const prefix =
            inline && index === 0 ? `  ${call.result === undefined ? "└" : "├"} ` : "    ";
        lines.push(`${DIM}${prefix}${reviewLine}${NOT_BOLD_OR_DIM}`);
    }

    const resultLines = renderResultLines(call.result, Math.max(1, width - 4), maxResultRows);
    for (const [index, resultLine] of resultLines.entries()) {
        const prefix = inline && index === 0 ? "  └ " : "    ";
        lines.push(`${DIM}${prefix}${resultLine}${NOT_BOLD_OR_DIM}`);
    }

    return lines.map((line) => truncateToWidth(line, width, "", false));
}

function compactArguments(value: unknown): string {
    if (value === undefined) return "";
    try {
        return sanitizeTerminalText(JSON.stringify(value) ?? "");
    } catch {
        return sanitizeTerminalText(JSON.stringify(String(value)));
    }
}

function invocationLayout(call: CodexMcpToolCall): InvocationLayout {
    const server = sanitizeName(call.invocation.server);
    const tool = sanitizeName(call.invocation.tool);
    const argumentsText = compactArguments(call.invocation.arguments);
    const toolStart = server.length + 1;
    const toolEnd = toolStart + tool.length;
    const argumentsStart = toolEnd + 1;
    const argumentsEnd = argumentsStart + argumentsText.length;
    return {
        argumentsEnd,
        argumentsStart,
        plain: `${server}.${tool}(${argumentsText})`,
        serverEnd: server.length,
        toolEnd,
        toolStart,
    };
}

function renderHeader(status: CodexMcpToolCall["status"], palette: CodexMcpToolPalette): string {
    const label = status === "active" ? "Calling" : "Called";
    const bullet =
        status === "active"
            ? `${palette.primary}${DIM}◦${NOT_BOLD_OR_DIM}`
            : `${status === "error" ? palette.error : palette.success}${BOLD}•${NOT_BOLD_OR_DIM}${palette.primary}`;
    return `${bullet} ${BOLD}${label}${NOT_BOLD_OR_DIM}`;
}

function renderNarrowCall(
    call: CodexMcpToolCall,
    invocation: InvocationLayout,
    header: string,
    palette: CodexMcpToolPalette,
    width: number,
    limits: { readonly maxReviewRows: number; readonly maxResultRows: number },
): string[] {
    const lines = [header];
    if (width >= 5) {
        lines.push(
            `${DIM}  └ ${NOT_BOLD_OR_DIM}${renderInvocationSegment(invocation, 0, invocation.plain, palette)}`,
        );
        const contentWidth = Math.max(1, width - 4);
        const reviewLines = renderResultLines(call.review, contentWidth, limits.maxReviewRows);
        const resultLines = renderResultLines(call.result, contentWidth, limits.maxResultRows);
        for (const line of [...reviewLines, ...resultLines]) {
            lines.push(`${DIM}    ${line}${NOT_BOLD_OR_DIM}`);
        }
    }
    return lines.map((line) => truncateToWidth(line, width, "", false));
}

function renderInvocationSegment(
    layout: InvocationLayout,
    start: number,
    text: string,
    palette: CodexMcpToolPalette,
): string {
    const end = start + text.length;
    const boundaries = [
        start,
        end,
        layout.serverEnd,
        layout.toolStart,
        layout.toolEnd,
        layout.argumentsStart,
        layout.argumentsEnd,
    ]
        .filter((boundary) => boundary >= start && boundary <= end)
        .sort((left, right) => left - right)
        .filter((boundary, index, values) => index === 0 || boundary !== values[index - 1]);
    let rendered = "";

    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const rangeStart = boundaries[index] ?? start;
        const rangeEnd = boundaries[index + 1] ?? end;
        if (rangeEnd <= rangeStart) continue;
        const value = layout.plain.slice(rangeStart, rangeEnd);
        if (
            (rangeStart >= 0 && rangeEnd <= layout.serverEnd) ||
            (rangeStart >= layout.toolStart && rangeEnd <= layout.toolEnd)
        ) {
            rendered += `${palette.accent}${value}${palette.primary}`;
        } else if (rangeStart >= layout.argumentsStart && rangeEnd <= layout.argumentsEnd) {
            rendered += `${DIM}${value}${NOT_BOLD_OR_DIM}`;
        } else {
            rendered += value;
        }
    }

    return rendered;
}

function renderResultLines(
    result: CodexMcpToolCall["result"],
    width: number,
    maxRows: number,
): string[] {
    if (result === undefined || maxRows === 0) return [];
    const blocks = typeof result === "string" ? [result] : result;
    const wrapped = blocks.flatMap((block) =>
        wrapTextWithAnsi(sanitizeTerminalText(block).replaceAll("\t", "    "), width),
    );
    if (wrapped.length <= maxRows) return wrapped;

    const visible = wrapped.slice(0, maxRows);
    const lastIndex = visible.length - 1;
    const ellipsis = width >= 3 ? "..." : ".".repeat(width);
    visible[lastIndex] = `${truncateToWidth(
        visible[lastIndex] ?? "",
        Math.max(0, width - visibleWidth(ellipsis)),
        "",
    )}${ellipsis}`;
    return visible;
}

function sanitizeName(value: string): string {
    return sanitizeTerminalText(value).replace(/\s+/gu, "_");
}

function wrapWithHangingIndent(
    text: string,
    firstWidth: number,
    continuationWidth: number,
): WrappedSegment[] {
    const tokens = tokenize(text);
    const lines: WrappedSegment[] = [];
    let capacity = firstWidth;
    let lineStart: number | undefined;
    let lineEnd = 0;
    let lineWidth = 0;
    let pendingWhitespace: TextToken | undefined;

    const flush = () => {
        if (lineStart === undefined) return;
        lines.push({ start: lineStart, text: text.slice(lineStart, lineEnd) });
        lineStart = undefined;
        lineEnd = 0;
        lineWidth = 0;
        pendingWhitespace = undefined;
        capacity = continuationWidth;
    };

    for (const token of tokens) {
        if (token.whitespace) {
            if (lineStart !== undefined) pendingWhitespace = token;
            continue;
        }

        const whitespaceWidth = pendingWhitespace?.width ?? 0;
        if (lineStart !== undefined && lineWidth + whitespaceWidth + token.width > capacity) {
            flush();
        }

        if (token.width <= capacity) {
            if (lineStart === undefined) lineStart = token.start;
            lineEnd = token.end;
            lineWidth += (lineWidth === 0 ? 0 : (pendingWhitespace?.width ?? 0)) + token.width;
            pendingWhitespace = undefined;
            continue;
        }

        const graphemes = [
            ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(token.text),
        ];
        for (const grapheme of graphemes) {
            const graphemeWidth = visibleWidth(grapheme.segment);
            if (lineStart !== undefined && lineWidth + graphemeWidth > capacity) flush();
            if (lineStart === undefined) lineStart = token.start + grapheme.index;
            lineEnd = token.start + grapheme.index + grapheme.segment.length;
            lineWidth += graphemeWidth;
        }
        pendingWhitespace = undefined;
    }

    flush();
    return lines.length > 0 ? lines : [{ start: 0, text: "" }];
}

function tokenize(text: string): TextToken[] {
    const tokens: TextToken[] = [];
    for (const match of text.matchAll(/\s+|\S+/gu)) {
        const value = match[0];
        const start = match.index;
        tokens.push({
            start,
            end: start + value.length,
            text: value,
            whitespace: /^\s+$/u.test(value),
            width: visibleWidth(value),
        });
    }
    return tokens;
}
