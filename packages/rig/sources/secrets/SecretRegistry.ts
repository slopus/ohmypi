import type { SecretReference, SecretRegistration } from "./types.js";
import { validateSecretRegistration } from "./validateSecretRegistration.js";

export class SecretRegistry {
    readonly #environmentVariables = new Map<string, Map<string, string>>();
    readonly #secrets = new Map<string, SecretRegistration>();

    constructor(secrets: readonly SecretRegistration[] = []) {
        for (const secret of secrets) this.register(secret);
    }

    register(secret: SecretRegistration): void {
        validateSecretRegistration(secret);
        this.#secrets.set(secret.id, {
            description: secret.description.trim(),
            environment: { ...secret.environment },
            id: secret.id,
        });
        this.rememberEnvironmentVariables(secret.id, Object.keys(secret.environment));
    }

    unregister(secretId: string): boolean {
        this.#environmentVariables.delete(secretId);
        return this.#secrets.delete(secretId);
    }

    environmentVariables(secretId: string): readonly string[] {
        this.reference(secretId);
        return [...(this.#environmentVariables.get(secretId)?.values() ?? [])];
    }

    rememberEnvironmentVariables(secretId: string, names: readonly string[]): void {
        this.reference(secretId);
        const remembered = this.#environmentVariables.get(secretId) ?? new Map<string, string>();
        for (const name of names) remembered.set(name.toUpperCase(), name);
        this.#environmentVariables.set(secretId, remembered);
    }

    reference(secretId: string): SecretReference {
        const secret = this.#secrets.get(secretId);
        if (secret === undefined) {
            throw new Error(`Secret '${secretId}' is not registered in this Rig instance.`);
        }
        return {
            description: secret.description,
            environmentVariables: Object.keys(secret.environment),
            id: secret.id,
        };
    }

    references(): readonly SecretReference[] {
        return [...this.#secrets.keys()].sort().map((secretId) => this.reference(secretId));
    }

    resolve(secretIds: readonly string[]): NodeJS.ProcessEnv {
        const environment = Object.create(null) as NodeJS.ProcessEnv;
        const owners = new Map<string, string>();
        for (const secretId of new Set(secretIds)) {
            const secret = this.#secrets.get(secretId);
            if (secret === undefined) {
                throw new Error(`Secret '${secretId}' is not registered in this Rig instance.`);
            }
            for (const [name, value] of Object.entries(secret.environment)) {
                const ownerKey = name.toUpperCase();
                const owner = owners.get(ownerKey);
                if (owner !== undefined) {
                    throw new Error(
                        `Secrets '${owner}' and '${secretId}' both define ${name}. Select only one of them for this command.`,
                    );
                }
                owners.set(ownerKey, secretId);
                environment[name] = value;
            }
        }
        return environment;
    }
}
