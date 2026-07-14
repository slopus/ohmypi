import { describe, expect, it } from "vitest";

import { renderBackgroundTerminalInteraction } from "./renderBackgroundTerminalInteraction.js";

describe("renderBackgroundTerminalInteraction", () => {
    it("renders one compact wait line", () => {
        expect(
            stripAnsi(
                renderBackgroundTerminalInteraction(
                    {
                        command: "sleep 5",
                        input: "",
                        sessionId: 1,
                        type: "background_terminal_interaction",
                    },
                    80,
                ).join("\n"),
            ),
        ).toBe("• Waited for background terminal · sleep 5");
    });

    it("renders actual input without terminal controls", () => {
        expect(
            stripAnsi(
                renderBackgroundTerminalInteraction(
                    {
                        command: "read value",
                        input: "hello\nworld\x1b[2J",
                        sessionId: 1,
                        type: "background_terminal_interaction",
                    },
                    80,
                ).join("\n"),
            ),
        ).toBe("↳ Interacted with background terminal · read value\n  └ hello\n    world");
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
    return result
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n");
}
