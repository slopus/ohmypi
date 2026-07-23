import { GrokApiKeyCredential } from "@/vendors/grok/GrokApiKeyCredential.js";
import { GrokSessionCredential } from "@/vendors/grok/GrokSessionCredential.js";
import type { GrokCredential } from "@/vendors/VendorCredential.js";

export function assertGrokCredential(credential: unknown): asserts credential is GrokCredential {
    if (credential instanceof GrokApiKeyCredential || credential instanceof GrokSessionCredential) {
        return;
    }

    const received =
        credential === null
            ? "null"
            : typeof credential === "object" && credential !== null && "name" in credential
              ? String((credential as { name: unknown }).name)
              : typeof credential;

    throw new Error(
        `GrokProvider requires a grok-api-key or grok-session credential, received ${received}.`,
    );
}
