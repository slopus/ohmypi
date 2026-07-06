import { CircleAlert, PanelRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActiveSessionState } from "@/hooks/useActiveSession";
import type { ModelCatalog, SessionSummary } from "@/protocol";

import { ActivityTab } from "./inspector/ActivityTab";
import { collectToolActivity } from "./inspector/collectToolActivity";
import { DetailsTab } from "./inspector/DetailsTab";

export interface InspectorPanelProps {
    /**
     * The single shared useActiveSession instance owned by App.tsx (the same
     * object is passed to ChatPanel — do not instantiate another).
     */
    activeSession: ActiveSessionState;
    /** Model catalog from health, for the model Select. */
    catalog: ModelCatalog | undefined;
    /** Selected session id; undefined renders the placeholder state. */
    sessionId: string | undefined;
    /**
     * List summary of the selected session (has createdAt/updatedAt, which
     * ProtocolSession lacks). Undefined until the session list contains it.
     */
    summary: SessionSummary | undefined;
}

function PanelShell(props: { children: ReactNode }) {
    return (
        <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-border/60 bg-background">
            {props.children}
        </aside>
    );
}

function PanelHint(props: { icon: ReactNode; text: string }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            {props.icon}
            <p className="text-xs text-muted-foreground">{props.text}</p>
        </div>
    );
}

export function InspectorPanel(props: InspectorPanelProps) {
    const { activeSession } = props;
    const { isRunning, messages, session, streamingPartial } = activeSession;

    const activity = useMemo(
        () => collectToolActivity(messages, streamingPartial, isRunning),
        [isRunning, messages, streamingPartial],
    );

    const messageCount = useMemo(
        () => messages.filter((message) => message.role !== "system").length,
        [messages],
    );

    if (props.sessionId === undefined) {
        return (
            <PanelShell>
                <PanelHint
                    icon={<PanelRight className="size-5 text-muted-foreground/50" />}
                    text="Select a session to inspect its details and activity."
                />
            </PanelShell>
        );
    }

    if (activeSession.loadError !== undefined) {
        return (
            <PanelShell>
                <PanelHint
                    icon={<CircleAlert className="size-5 text-red-400" />}
                    text={activeSession.loadError}
                />
            </PanelShell>
        );
    }

    if (activeSession.isLoading || session === undefined) {
        return (
            <PanelShell>
                <div className="flex flex-col gap-4 p-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            </PanelShell>
        );
    }

    return (
        <PanelShell>
            <Tabs
                className="flex h-full min-h-0 flex-col gap-0"
                defaultValue="details"
                key={props.sessionId}
            >
                <div className="shrink-0 border-b border-border/60 p-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="activity">
                            {activity.length > 0 ? `Activity (${activity.length})` : "Activity"}
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent className="min-h-0 flex-1 overflow-y-auto" value="details">
                    <DetailsTab
                        catalog={props.catalog}
                        changeEffort={activeSession.changeEffort}
                        changeModel={activeSession.changeModel}
                        isRunning={activeSession.isRunning}
                        messageCount={messageCount}
                        reset={activeSession.reset}
                        session={session}
                        summary={props.summary}
                        toolCallCount={activity.length}
                    />
                </TabsContent>
                <TabsContent className="min-h-0 flex-1 overflow-y-auto" value="activity">
                    <ActivityTab entries={activity} />
                </TabsContent>
            </Tabs>
        </PanelShell>
    );
}
