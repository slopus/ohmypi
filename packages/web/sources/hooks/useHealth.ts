import { useEffect, useState } from "react";

import { fetchHealth } from "../api";
import type { HealthResponse } from "../protocol";

const POLL_INTERVAL_MS = 5_000;

export interface HealthState {
    /** Error from the most recent poll, if it failed (e.g. daemon unreachable). */
    error: string | undefined;
    /** Last successful health response; undefined until the first poll succeeds. */
    health: HealthResponse | undefined;
}

/** Polls `GET /api/health` every five seconds. */
export function useHealth(): HealthState {
    const [health, setHealth] = useState<HealthResponse | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            try {
                const response = await fetchHealth();
                if (!cancelled) {
                    setHealth(response);
                    setError(undefined);
                }
            } catch (pollError) {
                if (!cancelled) {
                    setError(
                        pollError instanceof Error
                            ? pollError.message
                            : "The daemon could not be reached.",
                    );
                }
            }
        };

        void poll();
        const timer = window.setInterval(() => {
            void poll();
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, []);

    return { error, health };
}
