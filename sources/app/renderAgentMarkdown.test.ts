import { resetCapabilitiesCache, setCapabilities } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";

import { renderAgentMarkdown } from "./renderAgentMarkdown.js";

describe("renderAgentMarkdown", () => {
    it("renders markdown formatting instead of plain wrapping", () => {
        const raw = renderAgentMarkdown({
            text: "## Plan\n\n- **Build** `agent`\n\n```ts\nconst value = 1;\n```",
            width: 64,
            cwd: "/workspace",
        }).join("\n");
        const rendered = stripAnsiAndLinks(raw);

        expect(raw).toContain("\x1b[1m");
        expect(raw).not.toContain("\x1b[48;5;236m");
        expect(rendered).toContain("Plan");
        expect(rendered).toContain("- Build");
        expect(rendered).toContain("Build agent");
        expect(rendered).not.toContain("Build  agent");
        expect(rendered).toContain("agent");
        expect(rendered).toContain("const value = 1;");
    });

    it("renders explicit markdown links as terminal hyperlinks", () => {
        setCapabilities({ images: null, trueColor: true, hyperlinks: true });
        try {
            const raw = renderAgentMarkdown({
                text: "Open [the app](file:///workspace/sources/app/CodingAssistantApp.ts#L12) and https://example.com/docs.",
                width: 100,
                cwd: "/workspace",
            }).join("\n");
            const rendered = stripAnsiAndLinks(raw);

            expect(raw).toContain("file:///workspace/sources/app/CodingAssistantApp.ts#L12");
            expect(raw).toContain("https://example.com/docs");
            expect(rendered).toContain("the app");
        } finally {
            resetCapabilitiesCache();
        }
    });

    it("does not auto-link slash-containing local paths", () => {
        const raw = renderAgentMarkdown({
            text: "Open sources/app/CodingAssistantApp.ts:12 and github.com/openai/codex.",
            width: 100,
            cwd: "/workspace",
        }).join("\n");

        expect(raw).not.toContain("file:///workspace");
        expect(stripAnsiAndLinks(raw)).toContain("sources/app/CodingAssistantApp.ts:12");
    });
});

function stripAnsiAndLinks(text: string): string {
    return text
        .replace(/\x1b\]8;;.*?\x07/g, "")
        .replace(/\x1b\]8;;\x07/g, "")
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/\x1b_pi:c\x07/g, "");
}
