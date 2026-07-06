import { useCallback, useEffect, useMemo, useState } from "react";

import { humanizeModelId } from "./humanizeModelId";
import { loadDashboard, type DashboardData } from "./loadDashboard";
import { SessionList } from "./SessionList";
import "./App.css";

export function App() {
    const [data, setData] = useState<DashboardData | undefined>();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            setData(await loadDashboard());
            setErrorMessage(undefined);
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "The web UI could not refresh.",
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const timer = window.setInterval(() => {
            void refresh();
        }, 5_000);
        return () => window.clearInterval(timer);
    }, [refresh]);

    const daemonMessage = useMemo(() => {
        if (data?.health.ready) {
            return "The local daemon is ready.";
        }
        if (data?.health.status === "starting") {
            return "The local daemon is starting.";
        }
        return data?.health.errorMessage ?? "The local daemon is not ready.";
    }, [data]);

    return (
        <main className="app-shell">
            <header className="top-bar">
                <div>
                    <p className="product-name">Oh My Pi Web</p>
                    <h1>Local agent control</h1>
                </div>
                <button
                    className="refresh-button"
                    disabled={isLoading}
                    onClick={() => void refresh()}
                >
                    {isLoading ? "Refreshing" : "Refresh"}
                </button>
            </header>

            {errorMessage !== undefined ? <div className="error-banner">{errorMessage}</div> : null}

            <section className="status-grid" aria-label="Daemon status">
                <div className="status-panel">
                    <span className={data?.health.ready ? "health-dot ready" : "health-dot"} />
                    <div>
                        <h2>Daemon</h2>
                        <p>{daemonMessage}</p>
                    </div>
                </div>
                <div className="status-panel">
                    <span className="metric">{data?.health.catalog?.models.length ?? 0}</span>
                    <div>
                        <h2>Available models</h2>
                        <p>
                            {data?.health.catalog?.defaultModelId === undefined
                                ? "Waiting for model data"
                                : humanizeModelId(data.health.catalog.defaultModelId)}
                        </p>
                    </div>
                </div>
            </section>

            <SessionList sessions={data?.sessions ?? []} />
        </main>
    );
}
