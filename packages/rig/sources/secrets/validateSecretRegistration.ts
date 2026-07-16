import type { SecretRegistration } from "./types.js";

const SECRET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const ENVIRONMENT_VARIABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export function validateSecretRegistration(secret: SecretRegistration): void {
    if (typeof secret.id !== "string" || !SECRET_ID_PATTERN.test(secret.id)) {
        throw new Error(
            "Secret IDs must be 1-128 characters using letters, numbers, periods, underscores, colons, or hyphens.",
        );
    }
    if (typeof secret.description !== "string" || secret.description.trim().length === 0) {
        throw new Error(`Secret '${secret.id}' must have a description.`);
    }
    if (
        secret.environment === null ||
        typeof secret.environment !== "object" ||
        Array.isArray(secret.environment)
    ) {
        throw new Error(`Secret '${secret.id}' must contain environment variables.`);
    }
    const entries = Object.entries(secret.environment);
    if (entries.length === 0) {
        throw new Error(`Secret '${secret.id}' must contain at least one environment variable.`);
    }
    const names = new Set<string>();
    for (const [name, value] of entries) {
        if (!ENVIRONMENT_VARIABLE_PATTERN.test(name)) {
            throw new Error(`Secret '${secret.id}' contains an invalid environment variable name.`);
        }
        const normalizedName = name.toUpperCase();
        if (names.has(normalizedName)) {
            throw new Error(`Secret '${secret.id}' contains duplicate environment variable names.`);
        }
        names.add(normalizedName);
        if (typeof value !== "string") {
            throw new Error(
                `Environment variable '${name}' in secret '${secret.id}' must be text.`,
            );
        }
        if (value.includes("\0")) {
            throw new Error(
                `Environment variable '${name}' in secret '${secret.id}' cannot contain a null byte.`,
            );
        }
    }
}
