import { resolveBedrockModelId } from "@/vendors/bedrock/impl/resolveBedrockModelId.js";
import { resolveCodexModelId } from "@/vendors/codex/impl/resolveCodexModelId.js";

/**
 * Resolves a rig model id to the wire model id for the Codex Responses path.
 *
 * Bedrock serves OpenAI models under dotted ids (openai.gpt-5.6-sol) and follows the
 * v1 wire contract, while native Codex uses the bare model name (gpt-5.6-sol). The
 * Codex session shares one inference path for both, so the credential decides which
 * mapping applies.
 */
export function resolveCodexSessionModelId(modelId: string, isBedrock: boolean): string {
    return isBedrock ? resolveBedrockModelId(modelId) : resolveCodexModelId(modelId);
}
