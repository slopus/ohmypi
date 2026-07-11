import type { FileSystemContext } from "../context/FileSystemContext.js";
import { formatSkillsForPrompt } from "./formatSkillsForPrompt.js";
import { loadSkills } from "./loadSkills.js";

export async function loadSkillInstructions(fs: FileSystemContext): Promise<string | undefined> {
    return formatSkillsForPrompt(await loadSkills(fs));
}
