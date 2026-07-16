import { describe, expect, it } from "vitest";

import { truncateTextTail } from "./truncateTextTail.js";

describe("truncateTextTail", () => {
    it("preserves unchanged text and truncates a long UTF-8 line at a character boundary", () => {
        expect(truncateTextTail("one\ntwo\n", { maxBytes: 100, maxLines: 10 })).toMatchObject({
            content: "one\ntwo\n",
            truncated: false,
        });

        const result = truncateTextTail(`head${"🙂".repeat(5)}tail`, {
            maxBytes: 12,
            maxLines: 10,
        });

        expect(result).toMatchObject({
            content: "🙂🙂tail",
            outputBytes: 12,
            outputLines: 1,
            truncated: true,
        });
        expect(result.content).not.toContain("�");
    });
});
