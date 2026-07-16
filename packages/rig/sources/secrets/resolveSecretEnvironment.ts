import type { SessionSecretContext } from "./SessionSecretContext.js";

export function resolveSecretEnvironment(
    context: SessionSecretContext | undefined,
    secretIds: readonly string[] | undefined,
): NodeJS.ProcessEnv {
    if (secretIds === undefined || secretIds.length === 0) return {};
    if (context === undefined) {
        throw new Error("This agent does not have a Rig secret context.");
    }
    return context.resolve(secretIds);
}
