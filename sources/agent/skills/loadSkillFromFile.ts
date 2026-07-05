import { basename, dirname, extname } from "node:path";

import type { FileSystemContext } from "../context/FileSystemContext.js";
import type { Skill } from "./Skill.js";
import type { SkillFrontmatter } from "./SkillFrontmatter.js";
import { isValidSkillDescription } from "./isValidSkillDescription.js";
import { isValidSkillName } from "./isValidSkillName.js";
import { parseSkillFrontmatter } from "./parseSkillFrontmatter.js";

export async function loadSkillFromFile(
    fs: FileSystemContext,
    filePath: string,
): Promise<Skill | undefined> {
    let content: string;
    try {
        content = await fs.readFile(filePath);
    } catch {
        return undefined;
    }

    let frontmatter: SkillFrontmatter;
    try {
        frontmatter = parseSkillFrontmatter(content).frontmatter;
    } catch {
        return undefined;
    }

    const baseDir = dirname(filePath);
    const fallbackName =
        basename(filePath) === "SKILL.md"
            ? basename(baseDir)
            : basename(filePath, extname(filePath));
    const name = typeof frontmatter.name === "string" ? frontmatter.name.trim() : fallbackName;
    const description =
        typeof frontmatter.description === "string" ? frontmatter.description.trim() : undefined;

    if (!isValidSkillName(name) || !isValidSkillDescription(description)) {
        return undefined;
    }

    return {
        name,
        description,
        filePath,
        baseDir,
        disableModelInvocation: frontmatter["disable-model-invocation"] === true,
    };
}
