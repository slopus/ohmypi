import type { SessionSecretContext } from "./SessionSecretContext.js";
import { resolveSecretEnvironment } from "./resolveSecretEnvironment.js";

export function createDockerCommandEnvironment(
    context: SessionSecretContext | undefined,
    secretIds: readonly string[] | undefined,
    ambientEnvironmentVariables: readonly string[] = [],
): NodeJS.ProcessEnv {
    const environment = Object.create(null) as NodeJS.ProcessEnv;
    const attachedNames = context?.environmentVariables() ?? [];
    const hiddenNames = new Set(attachedNames.map((name) => name.toUpperCase()));
    for (const name of attachedNames) environment[name] = "";
    for (const name of ambientEnvironmentVariables) {
        if (hiddenNames.has(name.toUpperCase())) environment[name] = "";
    }
    for (const [name, value] of Object.entries(resolveSecretEnvironment(context, secretIds))) {
        environment[name] = value;
    }
    return environment;
}
