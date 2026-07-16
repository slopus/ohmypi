import type { SecretReference } from "./types.js";
import type { SecretRegistry } from "./SecretRegistry.js";

export class SessionSecretContext {
    readonly #environmentVariables = new Map<string, Set<string>>();
    readonly #projectAttached = new Set<string>();
    readonly #registry: SecretRegistry;
    readonly #sessionAttached = new Set<string>();

    constructor(
        registry: SecretRegistry,
        sessionSecretIds: readonly string[] = [],
        projectSecretIds: readonly string[] = [],
    ) {
        this.#registry = registry;
        for (const secretId of sessionSecretIds) this.#attachRestored(secretId, "session");
        for (const secretId of projectSecretIds) this.#attachRestored(secretId, "project");
    }

    attach(secretId: string, scope: "project" | "session" = "session"): void {
        this.#registry.reference(secretId);
        this.#setForScope(scope).add(secretId);
        this.#rememberEnvironmentVariables(secretId);
    }

    detach(secretId: string, scope: "project" | "session" = "session"): boolean {
        const removed = this.#setForScope(scope).delete(secretId);
        if (!this.ids().includes(secretId)) this.#environmentVariables.delete(secretId);
        return removed;
    }

    ids(): readonly string[] {
        return [...new Set([...this.#sessionAttached, ...this.#projectAttached])].sort();
    }

    projectIds(): readonly string[] {
        return [...this.#projectAttached].sort();
    }

    sessionIds(): readonly string[] {
        return [...this.#sessionAttached].sort();
    }

    references(): readonly SecretReference[] {
        return this.ids().flatMap((secretId) => {
            try {
                const reference = this.#registry.reference(secretId);
                this.#rememberEnvironmentVariables(secretId);
                return [reference];
            } catch {
                return [];
            }
        });
    }

    environmentVariables(): readonly string[] {
        for (const secretId of this.ids()) this.#rememberEnvironmentVariables(secretId);
        return [
            ...new Set([...this.#environmentVariables.values()].flatMap((names) => [...names])),
        ];
    }

    resolve(secretIds: readonly string[]): NodeJS.ProcessEnv {
        const attached = new Set(this.ids());
        for (const secretId of secretIds) {
            if (!attached.has(secretId)) {
                throw new Error(`Secret '${secretId}' is not attached to this session or project.`);
            }
        }
        return this.#registry.resolve(secretIds);
    }

    #attachRestored(secretId: string, scope: "project" | "session"): void {
        this.#setForScope(scope).add(secretId);
        this.#rememberEnvironmentVariables(secretId);
    }

    #rememberEnvironmentVariables(secretId: string): void {
        try {
            const environmentVariables = this.#registry.environmentVariables(secretId);
            const names = this.#environmentVariables.get(secretId) ?? new Set<string>();
            for (const environmentVariable of environmentVariables) {
                names.add(environmentVariable);
            }
            this.#environmentVariables.set(secretId, names);
        } catch {
            // Restored IDs remain attached while the instance registry is rebuilt.
        }
    }

    #setForScope(scope: "project" | "session"): Set<string> {
        return scope === "project" ? this.#projectAttached : this.#sessionAttached;
    }
}
