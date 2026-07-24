import type { Model, Provider } from "@slopus/rig-execution";
import { isCodexV2CollaborationModel } from "../agent/tools/codex/isCodexV2CollaborationModel.js";

export function createEncryptedAgentTransportScope(
    provider: Provider,
    model: Model,
): string | undefined {
    if (provider.type !== "codex" || !isCodexV2CollaborationModel(model.id)) {
        return undefined;
    }
    return provider.id;
}
