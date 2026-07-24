import { describe, expect, it } from "vitest";

import { AnthropicBedrockProvider } from "@/vendors/bedrock/AnthropicBedrockProvider.js";
import { BedrockBearerTokenCredential } from "@/vendors/bedrock/BedrockBearerTokenCredential.js";
import { collectSessionEvents, textFromSessionEvents } from "./helpers/collectSessionEvents.js";

const LIVE =
    process.env.RIG_LIVE_TEST === "1" && process.env.AWS_BEARER_TOKEN_BEDROCK !== undefined;

describe.skipIf(!LIVE)("Anthropic Bedrock live session", () => {
    it("runs direct inference through preferred Bedrock Mantle", { timeout: 120_000 }, async () => {
        const credential = await BedrockBearerTokenCredential.tryLoad({
            env: process.env,
        });
        if (credential === null) {
            expect.fail("Missing AWS_BEARER_TOKEN_BEDROCK.");
        }
        const provider = new AnthropicBedrockProvider({
            credential,
            model: "anthropic/opus-4-8",
        });
        const session = await provider.session(`anthropic-bedrock-live-${Date.now()}`, {
            context: {
                instructions: "Follow exact response instructions. Do not add punctuation.",
                messages: [],
            },
            tools: [],
        });

        try {
            const events = await collectSessionEvents(
                session.run({
                    effort: "low",
                    context: {
                        messages: [
                            {
                                role: "user",
                                content: "Reply with exactly ANTHROPIC_BEDROCK_LIVE_OK",
                            },
                        ],
                    },
                }),
            );
            expect(textFromSessionEvents(events).trim()).toBe("ANTHROPIC_BEDROCK_LIVE_OK");
            expect(events.at(-1)).toEqual({ type: "done", state: "normal" });
        } finally {
            session.destroy();
        }
    });
});
