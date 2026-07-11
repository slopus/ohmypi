import { describe, expect, it } from "vitest";

import { createInferenceStream } from "./createInferenceStream.js";

describe("createInferenceStream", () => {
    it("keeps iterator failures observable through result without an unhandled promise", async () => {
        const failure = new Error("scripted provider failure");
        const stream = createInferenceStream(async function* () {
            yield* [];
            throw failure;
        });

        await expect(consume(stream)).rejects.toBe(failure);
        await expect(stream.result()).rejects.toBe(failure);
    });
});

async function consume(stream: AsyncIterable<unknown>): Promise<void> {
    for await (const _event of stream) {
        // Consume the provider boundary exactly as the agent loop does.
    }
}
