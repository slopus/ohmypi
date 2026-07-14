export type FileDiffKind = "add" | "delete" | "update";

export type FileDiffLineKind = "add" | "context" | "delete";

export interface FileDiffLine {
    readonly kind: FileDiffLineKind;
    readonly text: string;
}

export interface FileDiffHunk {
    readonly oldStart: number;
    readonly newStart: number;
    readonly lines: readonly FileDiffLine[];
}

export interface FileDiff {
    readonly path: string;
    readonly kind: FileDiffKind;
    readonly hunks: readonly FileDiffHunk[];
    readonly language?: string;
    /** Exact totals are retained when presentation rows have been omitted. */
    readonly added?: number;
    readonly deleted?: number;
    readonly omittedLines?: number;
}

export interface FileDiffToolResultPresentation {
    readonly type: "file_diff";
    readonly files: readonly FileDiff[];
    readonly omittedFiles?: number;
}

export interface BackgroundTerminalInteractionPresentation {
    readonly command: string;
    readonly input: string;
    readonly sessionId: number;
    readonly type: "background_terminal_interaction";
}

export interface ExecCommandPresentation {
    readonly command: string;
    readonly output: string;
    readonly sessionId?: number;
    readonly type: "exec_command";
}

export type ToolResultPresentation =
    | BackgroundTerminalInteractionPresentation
    | ExecCommandPresentation
    | FileDiffToolResultPresentation;
