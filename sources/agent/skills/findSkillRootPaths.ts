import { join, resolve } from "node:path";

import { buildAncestorDirs } from "../buildAncestorDirs.js";
import type { FileSystemContext } from "../context/FileSystemContext.js";
import { findProjectRoot } from "../findProjectRoot.js";
import { isDirectoryAtPath } from "./isDirectoryAtPath.js";

const USER_SKILL_DIRS = [".codex/skills", ".agents/skills", ".pi/agent/skills"] as const;
const PROJECT_SKILL_DIRS = [".agents/skills", ".pi/skills"] as const;

export async function findSkillRootPaths(fs: FileSystemContext): Promise<readonly string[]> {
    const cwd = resolve(fs.cwd);
    const projectRoot = await findProjectRoot(fs);
    const dirs = projectRoot === undefined ? [cwd] : buildAncestorDirs(projectRoot, cwd);
    const paths: string[] = [];

    if (fs.home !== undefined) {
        const home = resolve(fs.home);
        for (const skillDir of USER_SKILL_DIRS) {
            const candidate = join(home, skillDir);
            if (await isDirectoryAtPath(fs, candidate)) {
                paths.push(candidate);
            }
        }
    }

    for (const dir of dirs) {
        for (const skillDir of PROJECT_SKILL_DIRS) {
            const candidate = join(dir, skillDir);
            if (await isDirectoryAtPath(fs, candidate)) {
                paths.push(candidate);
            }
        }
    }

    return paths;
}
