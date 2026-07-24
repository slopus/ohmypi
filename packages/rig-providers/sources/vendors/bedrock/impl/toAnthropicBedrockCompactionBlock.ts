import type { BetaCompactionBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import type { SessionCompactionMessage } from "@/core/SessionContext.js";

export function toAnthropicBedrockCompactionBlock(
    message: SessionCompactionMessage,
): BetaCompactionBlockParam {
    const vendor: unknown = message.vendor;
    const encryptedContent =
        typeof vendor === "object" &&
        vendor !== null &&
        "type" in vendor &&
        vendor.type === "anthropic_compaction" &&
        "encryptedContent" in vendor &&
        (typeof vendor.encryptedContent === "string" || vendor.encryptedContent === null)
            ? vendor.encryptedContent
            : undefined;
    return {
        type: "compaction",
        content: message.content,
        ...(encryptedContent === undefined ? {} : { encrypted_content: encryptedContent }),
        cache_control: { type: "ephemeral" },
    };
}
