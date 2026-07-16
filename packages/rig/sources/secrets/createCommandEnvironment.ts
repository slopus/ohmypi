import type { SessionSecretContext } from "./SessionSecretContext.js";
import { resolveSecretEnvironment } from "./resolveSecretEnvironment.js";

export function createCommandEnvironment(
    baseEnvironment: NodeJS.ProcessEnv,
    context: SessionSecretContext | undefined,
    secretIds: readonly string[] | undefined,
): NodeJS.ProcessEnv {
    const hiddenNames = new Set(
        (context?.environmentVariables() ?? []).map((name) => name.toUpperCase()),
    );
    const environment = Object.create(null) as NodeJS.ProcessEnv;
    for (const [name, value] of Object.entries(baseEnvironment)) {
        if (value !== undefined && !hiddenNames.has(name.toUpperCase())) environment[name] = value;
    }
    for (const [name, value] of Object.entries(resolveSecretEnvironment(context, secretIds))) {
        environment[name] = value;
    }
    return environment;
}
