import { describe, expect, it } from "vitest";

import type { GrokCredential } from "@/vendors/VendorCredential.js";
import { GrokApiKeyCredential } from "@/vendors/grok/GrokApiKeyCredential.js";
import { GrokProvider } from "@/vendors/grok/GrokProvider.js";
import { GrokSessionCredential } from "@/vendors/grok/GrokSessionCredential.js";
import { collectSessionEvents, textFromSessionEvents } from "./helpers/collectSessionEvents.js";

const LIVE = process.env.RIG_LIVE_TEST === "1";
const describeLive = LIVE ? describe : describe.skip;

async function resolveGrokCredential(): Promise<GrokCredential | null> {
    return (await GrokSessionCredential.tryLoad()) ?? (await GrokApiKeyCredential.tryLoad());
}

describeLive("GrokProvider live", () => {
    it("streams tool-less inference against Grok Build", async () => {
        const credential = await resolveGrokCredential();
        if (credential === null) {
            expect.fail("RIG_LIVE_TEST=1 is set but no grok credentials were found");
        }

        const provider = new GrokProvider({ credential });
        const session = await provider.session(`grok-live-${Date.now()}`, {
            context: { instructions: "You are a concise assistant.", messages: [] },
            tools: [],
        });
        const events = await collectSessionEvents(
            session.run({
                context: {
                    messages: [{ role: "user", content: "Reply with exactly: grok live ok" }],
                },
                model: "grok-build",
            }),
        );

        const done = events.find((event) => event.type === "done" && event.state === "normal");
        const tokenUsage = events.find((event) => event.type === "token_usage");
        expect(done).toBeDefined();
        expect(tokenUsage).toBeDefined();

        const text = textFromSessionEvents(events);
        expect(text.toLowerCase()).toContain("grok live ok");
        if (tokenUsage?.type === "token_usage") {
            expect(tokenUsage.usage.totalTokens).toBeGreaterThan(0);
        }
    }, 120_000);
});
