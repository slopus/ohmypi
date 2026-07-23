import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionSkillsOptions } from "@/core/SessionSkill.js";
import type { SessionToolsOptions } from "@/core/SessionTool.js";

/** Immutable model-visible configuration and initial history for a session. */
export interface SessionOptions extends SessionSkillsOptions, SessionToolsOptions {
    readonly context: SessionContext;
}
