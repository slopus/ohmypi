type PatchPathDirectiveKind = "add" | "delete" | "move" | "update";

interface PatchPathDirective {
    kind: PatchPathDirectiveKind;
    path: string;
}

const DIRECTIVES: readonly {
    kind: PatchPathDirectiveKind;
    prefix: string;
}[] = [
    { kind: "add", prefix: "*** Add File: " },
    { kind: "delete", prefix: "*** Delete File: " },
    { kind: "update", prefix: "*** Update File: " },
    { kind: "move", prefix: "*** Move to: " },
];

export function parsePatchPathDirective(line: string): PatchPathDirective | undefined {
    for (const directive of DIRECTIVES) {
        if (line.startsWith(directive.prefix)) {
            return { kind: directive.kind, path: line.slice(directive.prefix.length) };
        }
    }
    return undefined;
}
