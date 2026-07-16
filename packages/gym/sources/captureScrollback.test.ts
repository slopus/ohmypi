import { describe, expect, it, vi } from "vitest";

import { captureScrollback } from "./captureScrollback.js";

describe("captureScrollback", () => {
    it("captures overlapping viewport pages once and restores the bottom", async () => {
        const rows = ["zero", "one", "two", "three", "four"];
        let offset = 0;
        const scrollToBottom = vi.fn(() => {
            offset = 3;
        });
        const gym = {
            terminal: {
                scrollBy(lines: number) {
                    offset += lines;
                },
                scrollToBottom,
                scrollToTop() {
                    offset = 0;
                },
                async snapshot() {
                    return {
                        rows: rows.slice(offset, offset + 2),
                        scroll: {
                            atBottom: offset === 3,
                            offset,
                            totalRows: 5,
                            visibleRows: 2,
                        },
                    };
                },
            },
        };

        await expect(captureScrollback(gym)).resolves.toBe(rows.join("\n"));
        expect(scrollToBottom).toHaveBeenCalledOnce();
    });

    it("restores the bottom when capturing a snapshot fails", async () => {
        const scrollToBottom = vi.fn();
        const gym = {
            terminal: {
                scrollBy: vi.fn(),
                scrollToBottom,
                scrollToTop: vi.fn(),
                snapshot: vi.fn().mockRejectedValue(new Error("snapshot failed")),
            },
        };

        await expect(captureScrollback(gym)).rejects.toThrow("snapshot failed");
        expect(scrollToBottom).toHaveBeenCalledOnce();
    });
});
