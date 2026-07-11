import { join } from "node:path";

import type { FileSystemContext } from "../context/FileSystemContext.js";
import { isFileAtPath } from "./isFileAtPath.js";

const SKILL_FILENAME = "SKILL.md";

export async function findSkillFilePaths(
    fs: FileSystemContext,
    root: string,
): Promise<readonly string[]> {
    const paths: string[] = [];
    await collectSkillFilePaths(fs, root, paths);
    return paths;
}

async function collectSkillFilePaths(
    fs: FileSystemContext,
    dir: string,
    paths: string[],
): Promise<void> {
    const skillFile = join(dir, SKILL_FILENAME);
    if (await isFileAtPath(fs, skillFile)) {
        paths.push(skillFile);
        return;
    }

    let entries: readonly string[];
    try {
        entries = [...(await fs.readdir(dir))].sort((a, b) => a.localeCompare(b));
    } catch {
        return;
    }

    for (const entry of entries) {
        if (entry.startsWith(".") || entry === "node_modules") continue;

        const entryPath = join(dir, entry);
        let isDirectory = false;
        try {
            const stats = await fs.stat(entryPath);
            isDirectory = stats.isDirectory;
        } catch {
            continue;
        }

        if (isDirectory) {
            await collectSkillFilePaths(fs, entryPath, paths);
        }
    }
}
