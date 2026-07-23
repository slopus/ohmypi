import type { SessionSkill } from "@/core/SessionSkill.js";
import { gpt_5_5_skills_instructions } from "@/vendors/codex/prompts/gpt_5_5_skills_instructions.js";
import { skills_closing } from "@/vendors/codex/prompts/skills_closing.js";
import { skills_header } from "@/vendors/codex/prompts/skills_header.js";
import { formatCodexSkillLocation } from "@/vendors/codex/impl/formatCodexSkillLocation.js";
import { isCodexV2Model } from "@/vendors/codex/impl/isCodexV2Model.js";

export function createCodexSkillsPrompt(
    skills: readonly SessionSkill[],
    model: string,
): string | undefined {
    if (skills.length === 0) return undefined;
    const catalog = skills
        .map(
            (skill) =>
                `- ${skill.name}: ${skill.description.slice(0, 1_024)} (${formatCodexSkillLocation(skill)})`,
        )
        .join("\n");
    return `${skills_header}${catalog}\n${
        isCodexV2Model(model) ? skills_closing : gpt_5_5_skills_instructions
    }`;
}
