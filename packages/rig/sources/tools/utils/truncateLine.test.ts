import { describe, expect, it } from "vitest";

import { truncateLine } from "./truncateLine.js";

describe("truncateLine", () => {
    it("preserves short lines and marks truncated lines", () => {
        expect(truncateLine("short", 5)).toEqual({ text: "short", wasTruncated: false });
        expect(truncateLine("longer", 4)).toEqual({
            text: "long... [truncated]",
            wasTruncated: true,
        });
        expect(truncateLine("🙂🙂🙂", 2)).toEqual({
            text: "🙂🙂... [truncated]",
            wasTruncated: true,
        });
    });
});
