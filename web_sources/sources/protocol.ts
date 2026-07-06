export interface HealthResponse {
    catalog?: ModelCatalog;
    errorMessage?: string;
    healthy: boolean;
    ready: boolean;
    status: "starting" | "ready" | "error";
}

export interface ModelCatalog {
    defaultModelId: string;
    models: readonly Model[];
}

export interface Model {
    id: string;
    name: string;
}

export interface ListSessionsResponse {
    sessions: readonly SessionSummary[];
}

export interface SessionSummary {
    cwd: string;
    effort?: string;
    id: string;
    lastMessageAt?: number;
    modelId: string;
    providerId: string;
    status: "idle" | "queued" | "running" | "completed" | "aborted" | "error";
    title?: string;
    updatedAt: number;
}
