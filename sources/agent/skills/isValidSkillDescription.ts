const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

export function isValidSkillDescription(description: string | undefined): description is string {
    if (description === undefined) return false;
    const trimmed = description.trim();
    return trimmed.length > 0 && trimmed.length <= MAX_SKILL_DESCRIPTION_LENGTH;
}
