import type { FileSystemContext } from "../context/FileSystemContext.js";
import type { Skill } from "./Skill.js";
import { findSkillFilePaths } from "./findSkillFilePaths.js";
import { findSkillRootPaths } from "./findSkillRootPaths.js";
import { loadSkillFromFile } from "./loadSkillFromFile.js";

export async function loadSkills(fs: FileSystemContext): Promise<readonly Skill[]> {
    const skillMap = new Map<string, Skill>();

    for (const root of await findSkillRootPaths(fs)) {
        for (const filePath of await findSkillFilePaths(fs, root)) {
            const skill = await loadSkillFromFile(fs, filePath);
            if (skill === undefined) continue;

            skillMap.set(skill.name, skill);
        }
    }

    return [...skillMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}
