import type { SessionSkill } from "@/core/SessionSkill.js";

export function formatCodexSkillLocation(skill: SessionSkill): string {
    return `${skill.source.replaceAll("_", " ")}: ${skill.location}`;
}
