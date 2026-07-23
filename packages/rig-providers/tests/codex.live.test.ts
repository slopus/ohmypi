import { describe, expect, it } from "vitest";

import { CodexProvider } from "@/vendors/codex/CodexProvider.js";
import { CodexSessionCredential } from "@/vendors/codex/CodexSessionCredential.js";
import type { CodexTransport } from "@/vendors/codex/impl/codexConstants.js";
import { collectSessionEvents, textFromSessionEvents } from "./helpers/collectSessionEvents.js";

const LIVE = process.env.RIG_LIVE_TEST === "1";
const describeLive = LIVE ? describe : describe.skip;
const model = "gpt-5.6-sol";

describeLive("CodexProvider live", () => {
    it.each(["websocket", "sse", "auto"] satisfies readonly CodexTransport[])(
        "streams tool-less inference over %s using the local Codex session",
        async (transport) => {
            const credential = await CodexSessionCredential.tryLoad();
            if (credential === null) {
                expect.fail(
                    "RIG_LIVE_TEST=1 is set but no local Codex session credential was found",
                );
            }

            const provider = new CodexProvider({ credential, transport });
            const session = await provider.session(`codex-${transport}-live-${Date.now()}`, {
                context: {
                    instructions: "You are a concise coding assistant.",
                    messages: [],
                },
                tools: [],
            });
            try {
                const events = await collectSessionEvents(
                    session.run({
                        context: {
                            messages: [
                                {
                                    role: "user",
                                    content: `Reply with exactly: codex ${transport} live ok`,
                                },
                            ],
                        },
                        model,
                    }),
                );

                expect(events).toContainEqual({ type: "done", state: "normal" });
                expect(events.some((event) => event.type === "token_usage")).toBe(true);
                expect(textFromSessionEvents(events).toLowerCase()).toContain(
                    `codex ${transport} live ok`,
                );
            } finally {
                await session.destroy();
            }
        },
        120_000,
    );
});
