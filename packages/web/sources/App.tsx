import { useCallback, useEffect, useState } from "react";

import { ChatPanel } from "./components/ChatPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { SessionSidebar } from "./components/SessionSidebar";
import { useActiveSession } from "./hooks/useActiveSession";
import { useHealth } from "./hooks/useHealth";
import { useSessionList } from "./hooks/useSessionList";
import type { ProtocolSession } from "./protocol";

export function App() {
    const [sessionPath, setSessionPath] = useState<readonly string[]>([]);
    const activeSessionId = sessionPath.at(-1);
    const primarySessionId = sessionPath.at(0);
    const { health, error: healthError } = useHealth();
    const sessionList = useSessionList();
    const activeSession = useActiveSession(activeSessionId);

    const { refresh: refreshSessions } = sessionList;

    const handleSessionCreated = useCallback(
        (session: ProtocolSession) => {
            setSessionPath([session.id]);
            refreshSessions();
        },
        [refreshSessions],
    );

    const handleSelectSession = useCallback((sessionId: string) => {
        setSessionPath([sessionId]);
    }, []);

    const handleOpenSubagent = useCallback((sessionId: string) => {
        setSessionPath((current) =>
            current.at(-1) === sessionId ? current : [...current, sessionId],
        );
    }, []);

    const handleBackToParent = useCallback(() => {
        setSessionPath((current) => (current.length > 1 ? current.slice(0, -1) : current));
    }, []);

    // Keep the sidebar in sync with title/status changes streamed for the
    // active session (the 5s poll covers everything else).
    const activeTitle = activeSession.session?.title;
    const activeStatus = activeSession.session?.status;
    useEffect(() => {
        refreshSessions();
    }, [activeTitle, activeStatus, refreshSessions]);

    const summary = sessionList.sessions.find((session) => session.id === activeSessionId);

    return (
        <div className="flex h-screen min-w-[1100px] bg-background text-foreground">
            <SessionSidebar
                activeSessionId={primarySessionId}
                health={health}
                healthError={healthError}
                isLoadingSessions={sessionList.isLoading}
                onSelectSession={handleSelectSession}
                onSessionCreated={handleSessionCreated}
                refreshSessions={refreshSessions}
                sessionListError={sessionList.error}
                sessions={sessionList.sessions}
            />
            <ChatPanel
                activeSession={activeSession}
                daemonReady={health?.ready === true && healthError === undefined}
                historyDepth={Math.max(0, sessionPath.length - 1)}
                onBackToParent={handleBackToParent}
                onOpenSubagent={handleOpenSubagent}
                sessionId={activeSessionId}
            />
            <InspectorPanel
                activeSession={activeSession}
                catalog={health?.catalog}
                onOpenSubagent={handleOpenSubagent}
                sessionId={activeSessionId}
                summary={summary}
            />
        </div>
    );
}
