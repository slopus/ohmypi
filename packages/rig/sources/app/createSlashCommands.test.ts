import { describe, expect, it } from "vitest";

import { createSlashCommands } from "./createSlashCommands.js";

describe("createSlashCommands", () => {
    it("describes secret attachments without limiting them to the session scope", () => {
        expect(createSlashCommands().find((command) => command.value === "secrets")).toMatchObject({
            label: "/secrets",
            description: "Manage secret bundles and attachments.",
        });
    });
});
