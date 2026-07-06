import { formatRelativeTime } from "./formatRelativeTime";
import { humanizeModelId } from "./humanizeModelId";
import { humanizeSessionStatus } from "./humanizeSessionStatus";
import type { SessionSummary } from "./protocol";

export interface SessionListProps {
    sessions: readonly SessionSummary[];
}

export function SessionList({ sessions }: SessionListProps) {
    if (sessions.length === 0) {
        return (
            <div className="empty-state">
                <h2>Recent sessions</h2>
                <p>No sessions have been created yet.</p>
            </div>
        );
    }

    return (
        <section className="session-section" aria-labelledby="recent-sessions-title">
            <div className="section-heading">
                <h2 id="recent-sessions-title">Recent sessions</h2>
                <span>{sessions.length} shown</span>
            </div>
            <div className="session-list">
                {sessions.map((session) => (
                    <article className="session-row" key={session.id}>
                        <div>
                            <h3>{session.title ?? "Untitled session"}</h3>
                            <p>{session.cwd}</p>
                        </div>
                        <div className="session-meta">
                            <span className={`status status-${session.status}`}>
                                {humanizeSessionStatus(session.status)}
                            </span>
                            <span>{humanizeModelId(session.modelId)}</span>
                            <span>
                                {formatRelativeTime(session.lastMessageAt ?? session.updatedAt)}
                            </span>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
