import { describe, expect, it } from "vitest";

import { createPermissionContext } from "./createPermissionContext.js";

describe("createPermissionContext", () => {
    it("scopes temporary permission overrides to the current asynchronous call", async () => {
        const context = createPermissionContext("auto");
        let release: () => void = () => {};
        const wait = new Promise<void>((resolve) => {
            release = resolve;
        });
        let started: () => void = () => {};
        const hasStarted = new Promise<void>((resolve) => {
            started = resolve;
        });

        const elevated = context.runWithMode("full_access", async () => {
            expect(context.mode).toBe("full_access");
            started();
            await wait;
            expect(context.mode).toBe("full_access");
        });
        await hasStarted;

        expect(context.mode).toBe("auto");
        context.setMode("read_only");
        expect(context.mode).toBe("read_only");
        release();
        await elevated;
        expect(context.mode).toBe("read_only");
    });
});
