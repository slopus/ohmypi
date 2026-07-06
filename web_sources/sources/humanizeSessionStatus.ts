import type { SessionSummary } from "./protocol";

export function humanizeSessionStatus(status: SessionSummary["status"]): string {
    switch (status) {
        case "aborted":
            return "Stopped";
        case "completed":
            return "Complete";
        case "error":
            return "Needs attention";
        case "idle":
            return "Idle";
        case "queued":
            return "Queued";
        case "running":
            return "Running";
    }
}
