import { useCallback, useEffect, useState } from "react";

import { ChatPanel } from "./components/ChatPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { SessionSidebar } from "./components/SessionSidebar";
import { useActiveSession } from "./hooks/useActiveSession";
import { useHealth } from "./hooks/useHealth";
import { useSessionList } from "./hooks/useSessionList";
import type { ProtocolSession } from "./protocol";

export function App() {
    const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
    const { health, error: healthError } = useHealth();
    const sessionList = useSessionList();
    const activeSession = useActiveSession(activeSessionId);

    const { refresh: refreshSessions } = sessionList;

    const handleSessionCreated = useCallback(
        (session: ProtocolSession) => {
            setActiveSessionId(session.id);
            refreshSessions();
        },
        [refreshSessions],
    );

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
                activeSessionId={activeSessionId}
                health={health}
                healthError={healthError}
                isLoadingSessions={sessionList.isLoading}
                onSelectSession={setActiveSessionId}
                onSessionCreated={handleSessionCreated}
                refreshSessions={refreshSessions}
                sessionListError={sessionList.error}
                sessions={sessionList.sessions}
            />
            <ChatPanel
                activeSession={activeSession}
                daemonReady={health?.ready === true && healthError === undefined}
                sessionId={activeSessionId}
            />
            <InspectorPanel
                activeSession={activeSession}
                catalog={health?.catalog}
                sessionId={activeSessionId}
                summary={summary}
            />
        </div>
    );
}
