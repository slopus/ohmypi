export type WorkflowRunStatus = "completed" | "error" | "running" | "stopped";

export interface WorkflowAgentCacheEntry {
    output: unknown;
    signature: string;
}

export interface WorkflowCheckpoint {
    nextAgentCallIndex: number;
    phase: string;
    snapshot: Uint8Array;
}

export interface WorkflowExecutionResult {
    agentCalls: readonly (WorkflowAgentCacheEntry | undefined)[];
    output: unknown;
}

export interface WorkflowRun {
    agentCount: number;
    code?: string;
    description: string;
    error?: string;
    finishedAt?: number;
    logs: readonly string[];
    name: string;
    output?: unknown;
    phase?: string;
    runId: string;
    startedAt: number;
    status: WorkflowRunStatus;
    taskId: string;
}

export interface WorkflowRunUpdate {
    agentCount?: number;
    code?: string;
    description?: string;
    error?: string;
    finishedAt?: number;
    log?: string;
    name?: string;
    output?: unknown;
    phase?: string;
    runId: string;
    startedAt?: number;
    status?: WorkflowRunStatus;
    taskId?: string;
}

export interface LaunchWorkflowRequest {
    code: string;
    description: string;
    execute(options: {
        onAgentCall(): void;
        onAgentResult(index: number, result: WorkflowAgentCacheEntry): void;
        onCheckpoint(checkpoint: WorkflowCheckpoint): void;
        onLog(message: string): void;
        resumeAgentCalls: readonly (WorkflowAgentCacheEntry | undefined)[];
        resumeCheckpoint?: WorkflowCheckpoint;
        runId: string;
        signal: AbortSignal;
    }): Promise<WorkflowExecutionResult>;
    name: string;
    resumeFromRunId?: string;
}

export interface WorkflowContext {
    get(runId: string): WorkflowRun | undefined;
    launch(request: LaunchWorkflowRequest): WorkflowRun;
    stop(runId: string): WorkflowRun | undefined;
    wait(runId: string, signal?: AbortSignal): Promise<WorkflowRun | undefined>;
}
