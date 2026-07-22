import { describe, expect, it } from "vitest";

import { parseShellExplorationPresentation } from "./parseShellExplorationPresentation.js";

describe("parseShellExplorationPresentation", () => {
    it("classifies a compound Codex shell exploration in execution order", () => {
        expect(
            parseShellExplorationPresentation(
                "rg --files src | head -n 20; rg -n 'needle value' src; sed -n '1,20p' src/example.ts",
            ),
        ).toEqual({
            type: "exploration",
            operations: [
                { kind: "list", target: "src" },
                {
                    command: "rg -n 'needle value' src",
                    kind: "search",
                    path: "src",
                    query: "needle value",
                },
                { kind: "read", name: "example.ts" },
            ],
        });
    });

    it("leaves unknown and mutating shell scripts on the normal command renderer", () => {
        expect(parseShellExplorationPresentation("pnpm test")).toBeUndefined();
        expect(
            parseShellExplorationPresentation("rg -l old src | xargs sed -i 's/old/new/g'"),
        ).toBeUndefined();
        expect(parseShellExplorationPresentation("cat source.txt > copy.txt")).toBeUndefined();
    });
});
