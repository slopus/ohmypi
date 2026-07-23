import type { BedrockCredential } from "@/vendors/VendorCredential.js";

export function assertBedrockCredential(value: unknown): asserts value is BedrockCredential {
    if (
        typeof value === "object" &&
        value !== null &&
        "name" in value &&
        (value as { name: unknown }).name === "bedrock-bearer-token"
    )
        return;
    throw new Error("BedrockProvider requires a bedrock-bearer-token credential.");
}
