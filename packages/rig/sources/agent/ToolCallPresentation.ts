export type ExplorationOperation =
    | { readonly kind: "list"; readonly target: string }
    | { readonly kind: "read"; readonly name: string }
    | {
          readonly command: string;
          readonly kind: "search";
          readonly path?: string;
          readonly query?: string;
      };

export interface ExplorationToolCallPresentation {
    readonly type: "exploration";
    readonly operations: readonly ExplorationOperation[];
}

export type ToolCallPresentation = ExplorationToolCallPresentation;
