import { dirname } from "node:path";

import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveToolPath } from "./path.js";

export interface ApplyPatchResult {
    applied: boolean;
    summary: string;
}

export async function applyPatchText(
    patch: string,
    cwd: string,
    context: AgentContext,
): Promise<ApplyPatchResult> {
    const lines = patch.replace(/\r\n/g, "\n").split("\n");
    if (lines[0] !== "*** Begin Patch") {
        throw new Error("Invalid patch: missing Begin Patch header");
    }
    if (!lines.some((line) => line === "*** End Patch")) {
        throw new Error("Invalid patch: missing End Patch footer");
    }

    const summaries: string[] = [];
    let index = 1;
    while (index < lines.length) {
        const line = lines[index];
        if (line === "*** End Patch") {
            break;
        }

        if (line?.startsWith("*** Add File: ")) {
            const filename = line.slice("*** Add File: ".length);
            const body: string[] = [];
            index++;
            while (index < lines.length && !lines[index]?.startsWith("*** ")) {
                const addLine = lines[index];
                if (!addLine?.startsWith("+")) {
                    throw new Error(`Invalid add-file line in ${filename}`);
                }
                body.push(addLine.slice(1));
                index++;
            }
            const target = resolveToolPath(filename, cwd);
            await context.fs.mkdir(dirname(target), { recursive: true });
            await context.fs.writeFile(target, body.join("\n"));
            summaries.push(`A ${filename}`);
            continue;
        }

        if (line?.startsWith("*** Delete File: ")) {
            const filename = line.slice("*** Delete File: ".length);
            await context.fs.rm(resolveToolPath(filename, cwd));
            summaries.push(`D ${filename}`);
            index++;
            continue;
        }

        if (line?.startsWith("*** Update File: ")) {
            const filename = line.slice("*** Update File: ".length);
            index = await applyUpdateFilePatch(lines, index + 1, filename, cwd, context);
            summaries.push(`M ${filename}`);
            continue;
        }

        throw new Error(`Invalid patch directive: ${line ?? ""}`);
    }

    return {
        applied: true,
        summary: ["Success. Updated the following files:", ...summaries].join("\n"),
    };
}

async function applyUpdateFilePatch(
    lines: readonly string[],
    index: number,
    filename: string,
    cwd: string,
    context: AgentContext,
): Promise<number> {
    const source = resolveToolPath(filename, cwd);
    let target = source;
    if (lines[index]?.startsWith("*** Move to: ")) {
        target = resolveToolPath(lines[index]?.slice("*** Move to: ".length) ?? "", cwd);
        index++;
    }

    const existing = await context.fs.readFile(source);
    let content = existing;
    while (index < lines.length && !lines[index]?.startsWith("*** ")) {
        if (lines[index] === "@@" || lines[index]?.startsWith("@@ ")) {
            index++;
            const remove: string[] = [];
            const add: string[] = [];
            while (
                index < lines.length &&
                !lines[index]?.startsWith("@@") &&
                !lines[index]?.startsWith("*** ")
            ) {
                const patchLine = lines[index] ?? "";
                const marker = patchLine[0];
                const text = patchLine.slice(1);
                if (marker === " ") {
                    remove.push(text);
                    add.push(text);
                } else if (marker === "-") {
                    remove.push(text);
                } else if (marker === "+") {
                    add.push(text);
                } else {
                    throw new Error(`Invalid update line for ${filename}`);
                }
                index++;
            }
            const oldText = remove.join("\n");
            const newText = add.join("\n");
            if (!content.includes(oldText)) {
                throw new Error(`Invalid patch: hunk did not match ${filename}`);
            }
            content = content.replace(oldText, newText);
            continue;
        }

        throw new Error(`Invalid update hunk for ${filename}`);
    }

    await context.fs.mkdir(dirname(target), { recursive: true });
    await context.fs.writeFile(target, content);
    if (target !== source) {
        await context.fs.rm(source);
    }
    return index;
}
