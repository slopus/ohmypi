export type SubagentRunStatus = "aborted" | "completed" | "error";

export interface SpawnSubagentRequest {
    description: string;
    parentToolCallId?: string;
    prompt: string;
}

export interface SpawnSubagentResult {
    output: string;
    sessionId: string;
    status: SubagentRunStatus;
}

export interface SubagentContext {
    canSpawn: boolean;
    depth: number;
    maxDepth: number;
    spawn(request: SpawnSubagentRequest, signal?: AbortSignal): Promise<SpawnSubagentResult>;
}
