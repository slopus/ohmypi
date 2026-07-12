import { truncateToWidth } from "@earendil-works/pi-tui";

import { humanizeWorkflowName } from "../workflows/index.js";
import type { ActiveWorkItem } from "./ActiveWorkItem.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const ORANGE = "\x1b[38;5;202m";

export function renderActiveWorkItem(item: ActiveWorkItem, width: number): string {
    const color = item.kind === "subagent" ? CYAN : item.kind === "workflow" ? ORANGE : GREEN;
    const kindLabel =
        item.kind === "subagent" ? "Agent" : item.kind === "workflow" ? "Workflow" : "Process";
    const label =
        item.kind === "subagent"
            ? item.subagent.description
            : item.kind === "workflow"
              ? humanizeWorkflowName(item.workflow.name)
              : item.process.command;
    const detail =
        item.kind === "subagent"
            ? item.subagent.status === "queued"
                ? "Queued"
                : "Running"
            : item.kind === "workflow"
              ? (item.workflow.phase ??
                `${item.workflow.agentCount} agent${item.workflow.agentCount === 1 ? "" : "s"}`)
              : item.process.cwd;
    const line = `  ${BOLD}${color}${kindLabel}${RESET} ${sanitizeTerminalText(label)} ${DIM}· ${sanitizeTerminalText(detail)}${RESET}`;
    return truncateToWidth(line, Math.max(1, width), "", true);
}
