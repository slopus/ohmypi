import { describe, expect, it } from "vitest";

import { ToolLockManager } from "./ToolLockManager.js";

describe("ToolLockManager", () => {
    it("releases shared keys after a failed operation", async () => {
        const manager = new ToolLockManager();
        const events: string[] = [];
        const failed = manager.run(["shared"], async () => {
            events.push("failed-start");
            await delay(10);
            events.push("failed-end");
            throw new Error("failed");
        });
        const recovered = manager.run(["shared"], () => {
            events.push("recovered");
        });

        await expect(failed).rejects.toThrow("failed");
        await recovered;
        expect(events).toEqual(["failed-start", "failed-end", "recovered"]);
    });

    it("continues to run disjoint keys concurrently", async () => {
        const manager = new ToolLockManager();
        const events: string[] = [];
        await Promise.all([
            manager.run(["slow"], async () => {
                events.push("slow-start");
                await delay(20);
                events.push("slow-end");
            }),
            manager.run(["fast"], async () => {
                events.push("fast-start");
                await delay(1);
                events.push("fast-end");
            }),
        ]);

        expect(events.indexOf("fast-start")).toBeLessThan(events.indexOf("slow-end"));
    });
});

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
