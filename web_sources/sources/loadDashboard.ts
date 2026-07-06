import type { HealthResponse, ListSessionsResponse } from "./protocol";

export interface DashboardData {
    health: HealthResponse;
    sessions: ListSessionsResponse["sessions"];
}

export async function loadDashboard(): Promise<DashboardData> {
    const [health, sessionList] = await Promise.all([
        requestJson<HealthResponse>("/health"),
        requestJson<ListSessionsResponse>("/sessions?limit=12"),
    ]);
    return {
        health,
        sessions: sessionList.sessions,
    };
}

async function requestJson<T>(path: string): Promise<T> {
    const response = await fetch(`/api${path}`, {
        headers: {
            accept: "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(await readErrorMessage(response));
    }
    return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
    const text = await response.text();
    if (text.length > 0) {
        try {
            const body = JSON.parse(text) as { error?: string; errorMessage?: string };
            return body.errorMessage ?? body.error ?? text;
        } catch {
            return text;
        }
    }
    return `The web UI could not load data from the local daemon.`;
}
