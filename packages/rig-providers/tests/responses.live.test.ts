import { describe, expect, it } from "vitest";

import { ResponsesProvider } from "@/responses/ResponsesProvider.js";
import { collectSessionEvents } from "./helpers/collectSessionEvents.js";

const LIVE = process.env.RIG_LIVE_TEST === "1";
const describeLive = LIVE ? describe : describe.skip;

describeLive("ResponsesProvider live", () => {
    it("runs a tool-less session turn", async () => {
        const session = await new ResponsesProvider().session(`responses-live-${Date.now()}`, {
            context: { instructions: "You are a concise assistant.", messages: [] },
            tools: [],
        });
        const events = await collectSessionEvents(
            session.run({
                context: {
                    messages: [{ role: "user", content: "Reply with exactly: responses live ok" }],
                },
            }),
        );

        expect(events.at(-1)).toEqual({ type: "done", state: "normal" });
        expect(events.at(-2)).toMatchObject({
            type: "token_usage",
        });
    }, 30_000);
});
