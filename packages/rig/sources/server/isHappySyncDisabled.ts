export function isHappySyncDisabled(environment: NodeJS.ProcessEnv = process.env): boolean {
    const value = environment.RIG_DISABLE_HAPPY_SYNC?.trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes";
}
