import type { Skill } from "./Skill.js";
import { escapeXml } from "./escapeXml.js";

export function formatSkillInvocation(skill: Skill, body: string, args: string): string {
    const skillBlock = [
        `<skill name="${escapeXml(skill.name)}" location="${escapeXml(skill.filePath)}">`,
        `References are relative to ${skill.baseDir}.`,
        "",
        body.trim(),
        "</skill>",
    ].join("\n");

    const trimmedArgs = args.trim();
    return trimmedArgs.length > 0 ? `${skillBlock}\n\n${trimmedArgs}` : skillBlock;
}
