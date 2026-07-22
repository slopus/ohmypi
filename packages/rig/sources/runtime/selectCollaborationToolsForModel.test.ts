import { describe, expect, it } from "vitest";

import { createClaudeSdkProvider } from "../providers/claude-sdk.js";
import { createKimiProvider } from "../providers/kimi.js";
import { modelAnthropicSonnet46, modelMoonshotKimiK3 } from "../providers/models.js";
import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { selectCollaborationToolsForModel } from "./selectCollaborationToolsForModel.js";

describe("selectCollaborationToolsForModel", () => {
    it("selects profile-owned Claude and Kimi collaboration surfaces", () => {
        const harness = createJustBashToolHarness();
        const claude = createClaudeSdkProvider({
            agentContext: harness.context,
            pathToClaudeCodeExecutable: "/test/claude",
        });
        const kimi = createKimiProvider({ apiKey: "test" });

        expect(
            selectCollaborationToolsForModel({
                model: modelAnthropicSonnet46,
                provider: claude,
            }).map((tool) => tool.name),
        ).toEqual(["Agent", "Workflow", "WaitForWorkflow", "SendMessage"]);
        expect(
            selectCollaborationToolsForModel({ model: modelMoonshotKimiK3, provider: kimi }).map(
                (tool) => tool.name,
            ),
        ).toEqual(["Agent", "SendMessage"]);
    });
});
