import {
    matchesKey,
    truncateToWidth,
    visibleWidth,
    wrapTextWithAnsi,
    type Component,
} from "@earendil-works/pi-tui";

import type { SubagentSummary } from "../protocol/index.js";
import type { WorkflowRun } from "../workflows/index.js";
import { humanizeWorkflowName, serializeWorkflowValue } from "../workflows/index.js";
import { formatActivityElapsedTime } from "./formatActivityElapsedTime.js";
import { humanizeWorkflowStatus } from "./humanizeWorkflowStatus.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ORANGE = "\x1b[38;5;202m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const SURFACE_BG = "\x1b[48;5;236m";
const INPUT_FG = "\x1b[38;5;255m";
const MUTED = "\x1b[38;5;245m";
const MAX_LIST_ITEMS = 8;
const MAX_DETAIL_LOGS = 6;
const MAX_DETAIL_RESULT_LINES = 8;
const MAX_DETAIL_TEXT_CHARS = 4_000;
const MAX_DETAIL_LOG_CHARS = 500;
const MAX_DETAIL_ACTIONS = 8;
const MAX_INSPECTION_LINES = 14;
const WORKFLOW_STATUS_COLORS = {
    completed: GREEN,
    error: RED,
    running: ORANGE,
    stopped: YELLOW,
} as const;

export interface CreateWorkflowMonitorOptions {
    getSubagents(): readonly SubagentSummary[];
    getWorkflows(): readonly WorkflowRun[];
    initialRunId?: string;
    now?: () => number;
    onCancel(): void;
    onRequestRender?(): void;
    onStop(runId: string): void | Promise<void>;
}

export function createWorkflowMonitor(options: CreateWorkflowMonitorOptions): Component {
    return new WorkflowMonitor(options);
}

class WorkflowMonitor implements Component {
    readonly #getSubagents: () => readonly SubagentSummary[];
    readonly #getWorkflows: () => readonly WorkflowRun[];
    readonly #now: () => number;
    readonly #onCancel: () => void;
    readonly #onRequestRender: (() => void) | undefined;
    readonly #onStop: (runId: string) => void | Promise<void>;

    #detailRunId: string | undefined;
    #detailSelectionIndex = 0;
    #inspectionScrollOffset = 0;
    #inspectionView: { kind: "agent"; agentId: string } | { kind: "code" } | undefined;
    #selectedIndex = 0;
    #stoppingRunId: string | undefined;

    constructor(options: CreateWorkflowMonitorOptions) {
        this.#detailRunId = options.initialRunId;
        this.#getSubagents = options.getSubagents;
        this.#getWorkflows = options.getWorkflows;
        this.#now = options.now ?? Date.now;
        this.#onCancel = options.onCancel;
        this.#onRequestRender = options.onRequestRender;
        this.#onStop = options.onStop;
    }

    invalidate(): void {}

    render(width: number): string[] {
        const workflows = this.#getWorkflows();
        const detail = workflows.find((workflow) => workflow.runId === this.#detailRunId);
        const lines =
            detail === undefined
                ? this.#renderList(workflows, width)
                : this.#inspectionView?.kind === "code"
                  ? this.#renderCode(detail, width)
                  : this.#inspectionView?.kind === "agent"
                    ? this.#renderAgent(detail, this.#inspectionView.agentId, width)
                    : this.#renderDetail(detail, width);
        return lines.map((line) => this.#surfaceLine(line, Math.max(1, width)));
    }

    handleInput(data: string): void {
        const workflows = this.#getWorkflows();
        const detail = workflows.find((workflow) => workflow.runId === this.#detailRunId);
        if (matchesKey(data, "escape")) {
            if (this.#inspectionView !== undefined) {
                this.#inspectionView = undefined;
                this.#inspectionScrollOffset = 0;
            } else if (detail !== undefined) {
                this.#detailRunId = undefined;
            } else {
                this.#onCancel();
            }
            return;
        }
        if (detail !== undefined) {
            if (this.#inspectionView !== undefined) {
                if (matchesKey(data, "up")) {
                    this.#inspectionScrollOffset = Math.max(0, this.#inspectionScrollOffset - 1);
                } else if (matchesKey(data, "down")) {
                    this.#inspectionScrollOffset += 1;
                }
                return;
            }
            const agents = this.#workflowAgents(detail.runId);
            const actionCount = agents.length + 1;
            if (matchesKey(data, "up")) {
                this.#detailSelectionIndex = Math.max(0, this.#detailSelectionIndex - 1);
                return;
            }
            if (matchesKey(data, "down")) {
                this.#detailSelectionIndex = Math.min(
                    actionCount - 1,
                    this.#detailSelectionIndex + 1,
                );
                return;
            }
            if (matchesKey(data, "enter")) {
                if (this.#detailSelectionIndex === 0) {
                    this.#inspectionView = { kind: "code" };
                } else {
                    const agent = agents[this.#detailSelectionIndex - 1];
                    if (agent !== undefined) {
                        this.#inspectionView = { agentId: agent.id, kind: "agent" };
                    }
                }
                this.#inspectionScrollOffset = 0;
                return;
            }
            if (data.toLowerCase() === "s" && detail.status === "running") {
                this.#stop(detail.runId);
            }
            return;
        }
        if (matchesKey(data, "up")) {
            this.#selectedIndex = Math.max(0, this.#selectedIndex - 1);
            return;
        }
        if (matchesKey(data, "down")) {
            this.#selectedIndex = Math.min(
                Math.max(0, workflows.length - 1),
                this.#selectedIndex + 1,
            );
            return;
        }
        if (matchesKey(data, "enter") && workflows[this.#selectedIndex] !== undefined) {
            this.#detailRunId = workflows[this.#selectedIndex]?.runId;
        }
    }

    #renderList(workflows: readonly WorkflowRun[], width: number): string[] {
        const running = workflows.filter((workflow) => workflow.status === "running").length;
        const lines = [
            "",
            `  ${ORANGE}${BOLD}Workflows${RESET}${SURFACE_BG}${INPUT_FG}`,
            `  ${MUTED}${running === 0 ? "No active workflows" : `${running} active`} · Updates live${RESET}${SURFACE_BG}${INPUT_FG}`,
            "",
        ];
        if (workflows.length === 0) {
            lines.push(`  ${MUTED}No workflows have been started in this session.${RESET}`);
        } else {
            this.#selectedIndex = Math.min(this.#selectedIndex, workflows.length - 1);
            const start = Math.max(
                0,
                Math.min(
                    this.#selectedIndex - Math.floor(MAX_LIST_ITEMS / 2),
                    workflows.length - MAX_LIST_ITEMS,
                ),
            );
            for (const [offset, workflow] of workflows
                .slice(start, start + MAX_LIST_ITEMS)
                .entries()) {
                const index = start + offset;
                const selected = index === this.#selectedIndex;
                const marker = selected ? "→ " : "  ";
                const phase =
                    workflow.phase === undefined
                        ? ""
                        : ` · ${sanitizeTerminalText(workflow.phase)}`;
                const agents = `${workflow.agentCount} agent${workflow.agentCount === 1 ? "" : "s"}`;
                const label = sanitizeTerminalText(humanizeWorkflowName(workflow.name));
                const content = `${marker}${label}  ${humanizeWorkflowStatus(workflow.status)} · ${agents}${phase}`;
                lines.push(
                    selected
                        ? `  ${ORANGE}${truncateToWidth(content, Math.max(1, width - 2))}${RESET}`
                        : `  ${truncateToWidth(content, Math.max(1, width - 2))}`,
                );
            }
        }
        lines.push("", `  ${DIM}${MUTED}Use ↑/↓ to move, Enter to open, Esc to close.${RESET}`, "");
        return lines;
    }

    #renderDetail(workflow: WorkflowRun, width: number): string[] {
        const contentWidth = Math.max(1, width - 4);
        const finishedAt = workflow.finishedAt ?? this.#now();
        const elapsed = formatActivityElapsedTime(finishedAt - workflow.startedAt);
        const agents = `${workflow.agentCount} agent${workflow.agentCount === 1 ? "" : "s"}`;
        const lines = [
            "",
            `  ${ORANGE}${BOLD}${sanitizeTerminalText(humanizeWorkflowName(workflow.name))}${RESET}${SURFACE_BG}${INPUT_FG}`,
            `  ${WORKFLOW_STATUS_COLORS[workflow.status]}${humanizeWorkflowStatus(workflow.status)}${RESET}${SURFACE_BG}${INPUT_FG} ${MUTED}· ${agents} · ${elapsed}${RESET}`,
            "",
            ...wrapTextWithAnsi(
                sanitizeTerminalText(workflow.description.slice(0, MAX_DETAIL_TEXT_CHARS)),
                contentWidth,
            ).map((line) => `  ${line}`),
        ];
        if (workflow.phase !== undefined) {
            lines.push(
                "",
                `  ${MUTED}${workflow.status === "running" ? "Current phase" : "Last phase"}${RESET}`,
                `  ${sanitizeTerminalText(workflow.phase.slice(0, MAX_DETAIL_LOG_CHARS))}`,
            );
        }
        const logs = workflow.logs
            .filter((log) => !log.startsWith("Phase: "))
            .slice(-MAX_DETAIL_LOGS);
        if (logs.length > 0) {
            lines.push(
                "",
                `  ${MUTED}Progress${RESET}`,
                ...logs.flatMap((log) =>
                    wrapTextWithAnsi(
                        `• ${sanitizeTerminalText(log.slice(0, MAX_DETAIL_LOG_CHARS))}`,
                        contentWidth,
                    ).map((line) => `  ${line}`),
                ),
            );
        }
        const result =
            workflow.error ??
            (workflow.output === undefined ? undefined : serializeWorkflowValue(workflow.output));
        if (result !== undefined) {
            const resultLines = sanitizeTerminalText(result.slice(0, MAX_DETAIL_TEXT_CHARS))
                .split("\n")
                .flatMap((line) => wrapTextWithAnsi(line, contentWidth))
                .slice(0, MAX_DETAIL_RESULT_LINES);
            lines.push(
                "",
                `  ${MUTED}${workflow.error === undefined ? "Result" : "Error"}${RESET}`,
                ...resultLines.map((line) => `  ${line}`),
            );
        }
        const workflowAgents = this.#workflowAgents(workflow.runId);
        const actions = [
            { id: "code", label: "View workflow code" },
            ...workflowAgents.map((agent, index) => ({
                id: agent.id,
                label: `Agent ${index + 1}  ${humanizeSubagentStatus(agent.status)} · ${sanitizeTerminalText(agent.description)}`,
            })),
        ];
        this.#detailSelectionIndex = Math.min(
            this.#detailSelectionIndex,
            Math.max(0, actions.length - 1),
        );
        const actionStart = Math.max(
            0,
            Math.min(
                this.#detailSelectionIndex - Math.floor(MAX_DETAIL_ACTIONS / 2),
                actions.length - MAX_DETAIL_ACTIONS,
            ),
        );
        lines.push("", `  ${MUTED}Inspect${RESET}`);
        for (const [offset, action] of actions
            .slice(actionStart, actionStart + MAX_DETAIL_ACTIONS)
            .entries()) {
            const selected = actionStart + offset === this.#detailSelectionIndex;
            const content = `${selected ? "→ " : "  "}${action.label}`;
            lines.push(
                selected
                    ? `  ${ORANGE}${truncateToWidth(content, contentWidth)}${RESET}`
                    : `  ${truncateToWidth(content, contentWidth)}`,
            );
        }
        lines.push(
            "",
            `  ${DIM}${MUTED}Use ↑/↓ to move · Enter to open · ${workflow.status === "running" ? "S to stop · " : ""}Esc to return.${RESET}`,
            "",
        );
        return lines;
    }

    #renderCode(workflow: WorkflowRun, width: number): string[] {
        const contentWidth = Math.max(1, width - 4);
        const source = workflow.code ?? "Workflow code is unavailable for this older run.";
        const content = source.split("\n").flatMap((line, index) => {
            const prefix = `${String(index + 1).padStart(4)}  `;
            const wrapped = wrapTextWithAnsi(
                `${MUTED}${prefix}${RESET}${sanitizeTerminalText(line)}`,
                contentWidth,
            );
            return wrapped.length === 0 ? [`${MUTED}${prefix}${RESET}`] : wrapped;
        });
        return this.#renderInspection({
            content,
            color: ORANGE,
            kind: "Workflow code",
            title: humanizeWorkflowName(workflow.name),
            width,
        });
    }

    #renderAgent(workflow: WorkflowRun, agentId: string, width: number): string[] {
        const agent = this.#workflowAgents(workflow.runId).find(
            (candidate) => candidate.id === agentId,
        );
        if (agent === undefined) {
            this.#inspectionView = undefined;
            return this.#renderDetail(workflow, width);
        }
        const contentWidth = Math.max(1, width - 4);
        const prompt = agent.prompt ?? "The incoming prompt is not available.";
        const latestText = agent.latestText ?? "No text response yet.";
        const content = [
            `${MUTED}Incoming prompt${RESET}`,
            ...wrapTextWithAnsi(sanitizeTerminalText(prompt), contentWidth),
            "",
            `${MUTED}Latest message${RESET}`,
            ...wrapTextWithAnsi(sanitizeTerminalText(latestText), contentWidth),
        ];
        return this.#renderInspection({
            content,
            color: "\x1b[36m",
            kind: "Workflow agent",
            status: humanizeSubagentStatus(agent.status),
            title: agent.description,
            width,
        });
    }

    #renderInspection(options: {
        color: string;
        content: readonly string[];
        kind: string;
        status?: string;
        title: string;
        width: number;
    }): string[] {
        const maxOffset = Math.max(0, options.content.length - MAX_INSPECTION_LINES);
        this.#inspectionScrollOffset = Math.min(this.#inspectionScrollOffset, maxOffset);
        const visible = options.content.slice(
            this.#inspectionScrollOffset,
            this.#inspectionScrollOffset + MAX_INSPECTION_LINES,
        );
        const scrollStatus =
            options.content.length <= MAX_INSPECTION_LINES
                ? ""
                : ` · Lines ${this.#inspectionScrollOffset + 1}-${this.#inspectionScrollOffset + visible.length} of ${options.content.length}`;
        return [
            "",
            `  ${options.color}${BOLD}${sanitizeTerminalText(options.kind)}${RESET}${SURFACE_BG}${INPUT_FG} ${sanitizeTerminalText(options.title)}`,
            ...(options.status === undefined
                ? []
                : [`  ${MUTED}${sanitizeTerminalText(options.status)}${RESET}`]),
            "",
            ...visible.map((line) => `  ${line}`),
            "",
            `  ${DIM}${MUTED}${options.content.length > MAX_INSPECTION_LINES ? "Use ↑/↓ to scroll" : "All content visible"}${scrollStatus} · Esc to return.${RESET}`,
            "",
        ];
    }

    #workflowAgents(runId: string): SubagentSummary[] {
        const prefix = `workflow_${runId}_`;
        return this.#getSubagents()
            .filter((agent) => agent.taskName?.startsWith(prefix) === true)
            .sort((left, right) => {
                const leftIndex = workflowAgentIndex(left.taskName);
                const rightIndex = workflowAgentIndex(right.taskName);
                return leftIndex - rightIndex || left.createdAt - right.createdAt;
            });
    }

    #stop(runId: string): void {
        if (this.#stoppingRunId !== undefined) return;
        this.#stoppingRunId = runId;
        void Promise.resolve(this.#onStop(runId)).finally(() => {
            this.#stoppingRunId = undefined;
            this.#onRequestRender?.();
        });
    }

    #surfaceLine(content: string, width: number): string {
        const restored = content.replaceAll(RESET, `${RESET}${SURFACE_BG}${INPUT_FG}`);
        const fitted = truncateToWidth(restored, width, "", true);
        const padding = " ".repeat(Math.max(0, width - visibleWidth(fitted)));
        return `${SURFACE_BG}${INPUT_FG}${fitted}${padding}${RESET}`;
    }
}

function humanizeSubagentStatus(status: SubagentSummary["status"]): string {
    if (status === "aborted") return "Stopped";
    if (status === "completed") return "Completed";
    if (status === "error") return "Failed";
    if (status === "idle") return "Idle";
    if (status === "queued") return "Queued";
    return "Running";
}

function workflowAgentIndex(taskName: string | undefined): number {
    const index = Number(taskName?.split("_").at(-1));
    return Number.isFinite(index) ? index : Number.MAX_SAFE_INTEGER;
}
