import { describe, expect, it } from "vitest";

import { ResponsesProvider } from "./ResponsesProvider.js";

describe("ResponsesProvider", () => {
    it("exposes a static and instance name", () => {
        const provider = new ResponsesProvider();

        expect(ResponsesProvider.name).toBe("responses");
        expect(provider.name).toBe("responses");
    });
});
