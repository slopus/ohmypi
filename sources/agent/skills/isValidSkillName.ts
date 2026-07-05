const MAX_SKILL_NAME_LENGTH = 64;

export function isValidSkillName(name: string): boolean {
    return (
        name.length > 0 &&
        name.length <= MAX_SKILL_NAME_LENGTH &&
        /^[a-z0-9-]+$/.test(name) &&
        !name.startsWith("-") &&
        !name.endsWith("-") &&
        !name.includes("--")
    );
}
