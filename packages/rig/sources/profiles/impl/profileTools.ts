import type { AnyDefinedTool } from "../../agent/types.js";
import { claudeCodeTools, claudeCollaborationTools } from "../../tools/claude/index.js";
import { codexCollaborationTools, codexTools } from "../../tools/codex/index.js";
import { grokBuildTools, grokCollaborationTools } from "../../tools/grok/index.js";
import { kimiCodeTools } from "../../tools/kimi/index.js";
import { kimiAgentTool, kimiSendMessageTool } from "../../tools/kimi/index.js";
import { piTools } from "../../tools/pi/index.js";
import { agentTool } from "../../tools/Agent.js";
import { sendMessageTool } from "../../tools/SendMessage.js";
import { applyClaudeProfileToolDefinitions } from "../claude/applyClaudeProfileToolDefinitions.js";
import { readClaudeProfileTools } from "../claude/readClaudeProfileArtifact.js";

// Differences from the captured Claude Code 2.1.201 preset: Rig omits Cron, worktree,
// NotebookEdit, ReportFindings, ScheduleWakeup, and Skill tools; adds Glob, Grep,
// AskUserQuestion, and WaitForWorkflow; rejects notebook/PDF Read cases; and adds secret
// bundles plus shared AgentContext sandbox/output behavior to Bash.
export function createClaudeProfileTools(stem: string): {
    base: readonly AnyDefinedTool[];
    collaboration: readonly AnyDefinedTool[];
} {
    const definitions = readClaudeProfileTools(stem);
    const collaborationNames = new Set([
        agentTool.name,
        ...claudeCollaborationTools.map((tool) => tool.name),
    ]);
    const registry = new Map(
        [...claudeCodeTools, agentTool, ...claudeCollaborationTools].map((tool) => [
            tool.name,
            tool,
        ]),
    );
    const seen = new Set<string>();
    const base: AnyDefinedTool[] = [];
    const collaboration: AnyDefinedTool[] = [];
    for (const definition of definitions) {
        if (seen.has(definition.name)) {
            throw new Error(`Claude profile artifact contains duplicate '${definition.name}'.`);
        }
        seen.add(definition.name);
        const implementation = registry.get(definition.name);
        if (implementation === undefined) {
            throw new Error(`Claude profile artifact selects unknown tool '${definition.name}'.`);
        }
        const hydrated = applyClaudeProfileToolDefinitions([implementation], [definition])[0]!;
        (collaborationNames.has(definition.name) ? collaboration : base).push(hydrated);
    }
    return { base, collaboration };
}
export const codexProfileTools = {
    base: codexTools,
    collaboration: codexCollaborationTools,
} as const;
export const grokProfileTools = {
    base: grokBuildTools,
    collaboration: grokCollaborationTools,
} as const;
export const kimiProfileTools = {
    base: kimiCodeTools,
    collaboration: [kimiAgentTool, kimiSendMessageTool],
} as const;
export const piProfileTools = {
    base: piTools,
    collaboration: [agentTool, sendMessageTool],
} as const;
