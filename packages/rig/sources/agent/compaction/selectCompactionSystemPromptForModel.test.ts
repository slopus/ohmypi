import { describe, expect, it } from "vitest";

import { KIMI_COMPACTION_SYSTEM_PROMPT } from "../../profiles/kimi/prompts/compactionSystemPrompt.js";
import { modelMoonshotKimiK3, modelOpenaiGpt54 } from "../../providers/models.js";
import { selectCompactionSystemPromptForModel } from "./selectCompactionSystemPromptForModel.js";

describe("selectCompactionSystemPromptForModel", () => {
    it("uses Kimi's first-person continuation contract only for Kimi models", () => {
        expect(selectCompactionSystemPromptForModel(modelMoonshotKimiK3)).toBe(
            KIMI_COMPACTION_SYSTEM_PROMPT,
        );
        expect(selectCompactionSystemPromptForModel(modelOpenaiGpt54)).toMatch(
            /^Create a detailed continuation brief/u,
        );
    });
});
