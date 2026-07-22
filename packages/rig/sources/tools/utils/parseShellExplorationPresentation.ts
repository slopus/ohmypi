import { parse, type SimpleCommandNode, type WordNode } from "just-bash";

import type {
    ExplorationOperation,
    ExplorationToolCallPresentation,
} from "../../agent/ToolCallPresentation.js";

export function parseShellExplorationPresentation(
    command: string,
): ExplorationToolCallPresentation | undefined {
    const operations = parseExplorationCommand(command);
    return operations === undefined ? undefined : { type: "exploration", operations };
}

function parseExplorationCommand(command: string): ExplorationOperation[] | undefined {
    let script;
    try {
        script = parse(command);
    } catch {
        return undefined;
    }

    const operations: ExplorationOperation[] = [];
    let cwd: string | undefined;
    for (const statement of script.statements) {
        if (statement.background || statement.deferredError !== undefined) return undefined;
        for (const pipeline of statement.pipelines) {
            if (pipeline.negated) return undefined;
            const commands: string[][] = [];
            for (const node of pipeline.commands) {
                if (node.type !== "SimpleCommand" || hasVisibleRedirection(node)) return undefined;
                const tokens = commandTokens(node);
                if (tokens === undefined) return undefined;
                commands.push(tokens);
            }

            const filtered =
                commands.length > 1
                    ? commands.filter((tokens) => !isFormattingCommand(tokens))
                    : commands;
            if (filtered.length === 0) return undefined;
            for (const tokens of filtered) {
                const [name, ...tail] = tokens;
                if (name === undefined) return undefined;
                if (name === "cd") {
                    const target = positionalOperands(tail, []).at(-1);
                    if (target === undefined) return undefined;
                    cwd = joinPath(cwd, target);
                    continue;
                }
                if (name === "true" || (name === "echo" && operations.length === 0)) continue;
                const operation = classifyCommand(tokens, cwd);
                if (operation === undefined) return undefined;
                if (!sameOperation(operations.at(-1), operation)) operations.push(operation);
            }
        }
    }

    return operations.length === 0 ? undefined : operations;
}

function classifyCommand(
    tokens: readonly string[],
    cwd?: string,
): ExplorationOperation | undefined {
    const [name, ...tail] = tokens;
    if (name === undefined) return undefined;
    const command = shellJoin(tokens);

    if (name === "ls" || name === "eza" || name === "exa") {
        const flags =
            name === "ls"
                ? [
                      "-I",
                      "-w",
                      "--block-size",
                      "--color",
                      "--format",
                      "--quoting-style",
                      "--time-style",
                  ]
                : ["-I", "--color", "--ignore-glob", "--sort", "--time", "--time-style"];
        const path = positionalOperands(tail, flags)[0];
        return { kind: "list", target: path === undefined ? command : shortDisplayPath(path) };
    }

    if (name === "tree" || name === "du") {
        const flags =
            name === "tree"
                ? ["-I", "-L", "-P", "--charset", "--filelimit", "--sort"]
                : ["-B", "-d", "--block-size", "--exclude", "--max-depth", "--time-style"];
        const path = positionalOperands(tail, flags)[0];
        return { kind: "list", target: path === undefined ? command : shortDisplayPath(path) };
    }

    if (name === "rg" || name === "rga" || name === "ripgrep-all") {
        if (tail.some((token) => token === "--replace" || token.startsWith("--replace="))) {
            return undefined;
        }
        const operands = positionalOperands(tail, [
            "-A",
            "-B",
            "-C",
            "-g",
            "-m",
            "-t",
            "--context",
            "--glob",
            "--iglob",
            "--max-count",
            "--max-depth",
            "--type",
            "--type-add",
            "--type-not",
        ]);
        if (tail.includes("--files")) {
            const path = operands[0];
            return { kind: "list", target: path === undefined ? command : shortDisplayPath(path) };
        }
        return searchOperation(command, operands[0], operands[1]);
    }

    if (name === "grep" || name === "egrep" || name === "fgrep") {
        return grepOperation(command, tail);
    }

    if (name === "git" && tail[0] === "grep") {
        return grepOperation(command, tail.slice(1));
    }

    if (name === "git" && tail[0] === "ls-files") {
        const path = positionalOperands(tail.slice(1), [
            "--exclude",
            "--exclude-from",
            "--pathspec-from-file",
        ])[0];
        return { kind: "list", target: path === undefined ? command : shortDisplayPath(path) };
    }

    if (name === "find" || name === "fd") {
        const queryFlagIndex = tail.findIndex((token) =>
            ["-iname", "-name", "-path", "-regex"].includes(token),
        );
        const query = queryFlagIndex < 0 ? undefined : tail[queryFlagIndex + 1];
        const path = positionalOperands(tail, [
            "-d",
            "-E",
            "-e",
            "-t",
            "--exclude",
            "--extension",
            "--max-depth",
            "--type",
        ])[name === "fd" && query === undefined ? 1 : 0];
        return query === undefined && (name === "find" || tail.length === 0)
            ? { kind: "list", target: path === undefined ? command : shortDisplayPath(path) }
            : searchOperation(
                  command,
                  query ?? positionalOperands(tail, ["-d", "-E", "-e", "-t"])[0],
                  path,
              );
    }

    if (["cat", "less", "more"].includes(name)) {
        const flags =
            name === "less"
                ? [
                      "-P",
                      "-j",
                      "-p",
                      "-x",
                      "-y",
                      "-z",
                      "--jump-target",
                      "--pattern",
                      "--prompt",
                      "--shift",
                      "--tabs",
                  ]
                : [];
        return readOperation(positionalOperands(tail, flags), cwd);
    }

    if (name === "bat" || name === "batcat") {
        return readOperation(
            positionalOperands(tail, [
                "--language",
                "--line-range",
                "--map-syntax",
                "--style",
                "--tabs",
                "--terminal-width",
                "--theme",
            ]),
            cwd,
        );
    }

    if (name === "head" || name === "tail" || name === "nl") {
        const operands = positionalOperands(tail, ["-b", "-c", "-i", "-n", "-s", "-v", "-w"]);
        return readOperation(operands, cwd);
    }

    if (name === "sed") {
        if (tail.some((token) => token === "-i" || token.startsWith("-i"))) return undefined;
        const operands = positionalOperands(tail, ["-e", "-f", "--expression", "--file"]);
        const rangeIndex = operands.findIndex((operand) => isSedRange(operand));
        if (!tail.includes("-n") || rangeIndex < 0) return undefined;
        return readOperation(operands.slice(rangeIndex + 1), cwd);
    }

    return undefined;
}

function grepOperation(command: string, args: readonly string[]): ExplorationOperation | undefined {
    let explicitPattern: string | undefined;
    const operands: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === undefined) continue;
        if (["-e", "--regexp", "-f", "--file"].includes(token)) {
            explicitPattern ??= args[index + 1];
            index += 1;
        } else if (
            [
                "-A",
                "-B",
                "-C",
                "-m",
                "--after-context",
                "--before-context",
                "--context",
                "--max-count",
            ].includes(token)
        ) {
            index += 1;
        } else if (!token.startsWith("-")) {
            operands.push(token);
        }
    }
    return searchOperation(
        command,
        explicitPattern ?? operands[0],
        explicitPattern === undefined ? operands[1] : operands[0],
    );
}

function searchOperation(
    command: string,
    query?: string,
    path?: string,
): ExplorationOperation | undefined {
    if (query === undefined && path === undefined) return undefined;
    return {
        command,
        kind: "search",
        ...(path === undefined ? {} : { path: shortDisplayPath(path) }),
        ...(query === undefined ? {} : { query }),
    };
}

function readOperation(
    operands: readonly string[],
    cwd?: string,
): ExplorationOperation | undefined {
    if (operands.length !== 1) return undefined;
    const path = joinPath(cwd, operands[0] ?? "");
    return path.length === 0 ? undefined : { kind: "read", name: shortDisplayPath(path) };
}

function commandTokens(command: SimpleCommandNode): string[] | undefined {
    const name = command.name === null ? undefined : staticWord(command.name);
    if (name === undefined) return undefined;
    const args: string[] = [];
    for (const argument of command.args) {
        const value = staticWord(argument);
        if (value === undefined) return undefined;
        args.push(value);
    }
    return [name, ...args];
}

function staticWord(word: WordNode): string | undefined {
    let value = "";
    for (const part of word.parts) {
        if (part.type === "Literal" || part.type === "SingleQuoted" || part.type === "Escaped") {
            value += part.value;
        } else if (part.type === "DoubleQuoted") {
            const nested = staticWord({ parts: part.parts, type: "Word" });
            if (nested === undefined) return undefined;
            value += nested;
        } else if (part.type === "Glob") {
            value += part.pattern;
        } else if (part.type === "TildeExpansion") {
            value += part.user === null ? "~" : `~${part.user}`;
        } else {
            return undefined;
        }
    }
    return value;
}

function positionalOperands(args: readonly string[], flagsWithValues: readonly string[]): string[] {
    const operands: string[] = [];
    let afterDoubleDash = false;
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === undefined) continue;
        if (afterDoubleDash) {
            operands.push(token);
        } else if (token === "--") {
            afterDoubleDash = true;
        } else if (flagsWithValues.includes(token)) {
            index += 1;
        } else if (!token.startsWith("-")) {
            operands.push(token);
        }
    }
    return operands;
}

function isFormattingCommand(tokens: readonly string[]): boolean {
    const [name, ...tail] = tokens;
    if (name === undefined) return false;
    if (["column", "cut", "printf", "sort", "tr", "uniq", "wc", "yes"].includes(name)) {
        return true;
    }
    if (name === "head" || name === "tail") {
        return positionalOperands(tail, ["-c", "-n"]).length === 0;
    }
    if (name === "sed") {
        return !tail.some((token) => token === "-i" || token.startsWith("-i"));
    }
    return false;
}

function hasVisibleRedirection(command: SimpleCommandNode): boolean {
    return command.redirections.length > 0;
}

function isSedRange(value: string): boolean {
    return /^\d+(?:,\d+)?p$/u.test(value);
}

function shortDisplayPath(path: string): string {
    const parts = path
        .replaceAll("\\", "/")
        .replace(/\/+$/u, "")
        .split("/")
        .reverse()
        .filter(
            (part) =>
                part.length > 0 &&
                part !== "build" &&
                part !== "dist" &&
                part !== "node_modules" &&
                part !== "src",
        );
    return parts[0] ?? path;
}

function joinPath(base: string | undefined, path: string): string {
    if (base === undefined || path.startsWith("/") || /^[A-Za-z]:\\/u.test(path)) return path;
    return `${base.replace(/[\\/]$/u, "")}/${path}`;
}

function shellJoin(tokens: readonly string[]): string {
    return tokens
        .map((token) =>
            /^[A-Za-z0-9_./:=+,-]+$/u.test(token) ? token : `'${token.replaceAll("'", `'\\''`)}'`,
        )
        .join(" ");
}

function sameOperation(
    left: ExplorationOperation | undefined,
    right: ExplorationOperation,
): boolean {
    return left !== undefined && JSON.stringify(left) === JSON.stringify(right);
}
