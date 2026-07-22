// Claude Code 2.1.201 deviations, persisted in adjacent files under ./claude:
// Prompt added: a leading Rig/Fable identity. Prompt removed: unsupported auto-memory, Claude Code
// product text, and /fast guidance. Claude's compact system-reminder/hook instruction is retained.
// Tools removed: CronCreate/Delete/List, Enter/ExitWorktree, NotebookEdit, ReportFindings,
// ScheduleWakeup, and Skill. Tools added: Glob, Grep, AskUserQuestion, and WaitForWorkflow.
// Tools changed: Bash adds secrets and Rig's reviewed sandbox semantics; Read removes pages and
// rejects PDF/notebook parsing; TaskCreate removes Plan-mode guidance; TaskList removes its
// unsupported comments claim; WebFetch drops the model-only URI format keyword (execution still
// validates URLs). Agent removes subagent_type/isolation and adds context/effort/provider;
// Workflow replaces Claude's JavaScript/title contract with Rig's Python workflow contract;
// TaskOutput describes Rig shell/workflow results; TaskStop removes shell_id and requires task_id;
// SendMessage targets resumable Rig subagents and adds effort.
import { createModelProfile } from "./impl/createModelProfile.js";
import { claudeFable5Prompt } from "./claude/prompt.js";
import { createClaudeProfileTools } from "./impl/profileTools.js";
import { modelAnthropicFable5 } from "../providers/models.js";

export const claudeAnthropicFable5Profile = createModelProfile({
    providerType: "claude",
    vendor: "anthropic",
    model: modelAnthropicFable5,
    imageProfile: "claude",
    toolProfile: "claude",
    tools: createClaudeProfileTools("claude-fable-5"),
    prompt: claudeFable5Prompt,
    wireMode: "claude-agent-sdk",
    wireModelId: "claude-fable-5[1m]",
    maxOutputTokens: 128_000,
});
