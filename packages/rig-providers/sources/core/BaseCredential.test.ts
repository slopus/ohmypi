import { describe, expect, it } from "vitest";

import { BaseCredential } from "@/core/BaseCredential.js";

class TestCredential extends BaseCredential<"test", { readonly apiKey: string }> {
    static create(credential: { readonly apiKey: string }): TestCredential {
        return new TestCredential(credential);
    }

    private constructor(credential: { readonly apiKey: string }) {
        super("test", credential);
    }
}

describe("BaseCredential", () => {
    it("stores a const generic name and credential payload", () => {
        const credential = TestCredential.create({ apiKey: "secret" });

        expect(credential.name).toBe("test");
        expect(credential.credential.apiKey).toBe("secret");
    });
});
