import { GROK_DEFAULT_ENDPOINT } from "@/vendors/grok/impl/grokConstants.js";

export function isGrokProxyBaseUrl(baseUrl: string): boolean {
    try {
        const candidate = new URL(baseUrl);
        const trusted = new URL(GROK_DEFAULT_ENDPOINT);
        const trustedPath = trusted.pathname.replace(/\/$/u, "");
        const candidatePath = candidate.pathname.replace(/\/$/u, "");
        return (
            candidate.protocol === trusted.protocol &&
            candidate.hostname === trusted.hostname &&
            candidate.port === trusted.port &&
            (candidatePath === trustedPath || candidatePath.startsWith(`${trustedPath}/`))
        );
    } catch {
        return false;
    }
}
