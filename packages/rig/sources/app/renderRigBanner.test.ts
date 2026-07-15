import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";

import { renderRigBanner } from "./renderRigBanner.js";

describe("renderRigBanner", () => {
    it("renders the supplied Rig logo beside the installed version", () => {
        const rendered = stripAnsi(
            renderRigBanner({
                brand: "\x1b[38;5;202m",
                secondary: "\x1b[2m",
                version: "1.2.3",
                width: 80,
            }).join("\n"),
        );

        const lines = rendered.split("\n");
        expect(lines).toHaveLength(6);
        expect(lines[0]).toBe("  ██████╗ ██╗ ██████╗    ██╗   ██████╗    ██████╗  ");
        expect(lines[5]).toBe("  ╚═╝  ╚═╝╚═╝ ╚═════╝    ╚═╝╚═╝╚══════╝╚═╝╚═════╝  ");
    });

    it("places compact versions on the final logo row when block artwork does not fit", () => {
        const rendered = stripAnsi(
            renderRigBanner({
                brand: "",
                secondary: "",
                version: "1.2.3",
                width: 40,
            }).join("\n"),
        );

        expect(rendered.split("\n")).toHaveLength(6);
        expect(rendered).toContain("  ╚═╝  ╚═╝╚═╝ ╚═════╝   1.2.3  ");
    });

    it("keeps a compact identity in terminals too narrow for the logo", () => {
        const lines = renderRigBanner({
            brand: "\x1b[38;5;202m",
            secondary: "\x1b[2m",
            version: "1.2.3",
            width: 12,
        });

        expect(stripAnsi(lines.join("\n"))).toBe("  Rig 1.2.  ");
        expect(lines.every((line) => visibleWidth(line) <= 12)).toBe(true);
    });
});

function stripAnsi(value: string): string {
    let result = "";
    for (let index = 0; index < value.length; index += 1) {
        if (value[index] !== "\u001b") {
            result += value[index];
            continue;
        }
        while (index < value.length && value[index] !== "m") index += 1;
    }
    return result;
}
