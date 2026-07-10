import type { ProviderErrorCode } from "./types.js";

export function classifyCodexErrorCode(message: string): ProviderErrorCode | undefined {
    const normalized = message.toLowerCase();
    if (
        normalized.includes("image") &&
        (normalized.includes("does not represent a valid image") ||
            normalized.includes("invalid image") ||
            normalized.includes("unsupported mime type") ||
            (normalized.includes("image_url") && normalized.includes("invalid_value")))
    ) {
        return "invalid_image_request";
    }

    return undefined;
}
