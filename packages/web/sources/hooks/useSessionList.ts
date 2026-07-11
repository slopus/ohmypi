import { useCallback, useEffect, useState } from "react";

import { fetchSessions } from "../api";
import type { SessionSummary } from "../protocol";

const POLL_INTERVAL_MS = 5_000;

export interface SessionListState {
    /** Error from the most recent poll, if it failed. */
    error: string | undefined;
    /** True until the first poll settles. */
    isLoading: boolean;
    /** Triggers an immediate re-fetch (also resets the poll timer). */
    refresh: () => void;
    sessions: readonly SessionSummary[];
}

/** Polls `GET /api/sessions` every five seconds and exposes a manual refresh. */
export function useSessionList(): SessionListState {
    const [sessions, setSessions] = useState<readonly SessionSummary[]>([]);
    const [error, setError] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshToken, setRefreshToken] = useState(0);

    const refresh = useCallback(() => {
        setRefreshToken((token) => token + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            try {
                const response = await fetchSessions();
                if (!cancelled) {
                    setSessions(response.sessions);
                    setError(undefined);
                }
            } catch (pollError) {
                if (!cancelled) {
                    setError(
                        pollError instanceof Error
                            ? pollError.message
                            : "The session list could not be loaded.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
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
    }, [refreshToken]);

    return { error, isLoading, refresh, sessions };
}
