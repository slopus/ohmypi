import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/formatRelativeTime";
import type { ModelCatalog, ProtocolSession, SessionSummary } from "@/protocol";

import { DetailField } from "./DetailField";
import { EffortSelect } from "./EffortSelect";
import { ModelSelect } from "./ModelSelect";
import { ResetConversationButton } from "./ResetConversationButton";
import { SessionStatusBadge } from "./SessionStatusBadge";

export interface DetailsTabProps {
    catalog: ModelCatalog | undefined;
    changeEffort: (effort: string | undefined) => Promise<void>;
    changeModel: (modelId: string) => Promise<void>;
    isRunning: boolean;
    messageCount: number;
    reset: () => Promise<void>;
    session: ProtocolSession;
    summary: SessionSummary | undefined;
    toolCallCount: number;
}

function exactTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

/** The Details tab of the inspector: identity, model controls, stats, reset. */
export function DetailsTab(props: DetailsTabProps) {
    const { catalog, session, summary } = props;

    const currentModel =
        catalog?.models.find((model) => model.id === session.modelId) ??
        session.models.find((model) => model.id === session.modelId);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
                <h2 className="text-sm leading-snug font-medium break-words text-foreground">
                    {session.title !== undefined && session.title !== ""
                        ? session.title
                        : "Untitled session"}
                </h2>
                <SessionStatusBadge status={session.status} />
            </div>

            <Separator className="bg-border/60" />

            <DetailField label="Working directory">
                <p className="font-mono text-xs leading-relaxed break-all text-foreground/90">
                    {session.cwd}
                </p>
            </DetailField>

            <DetailField label="Model">
                <ModelSelect
                    catalog={catalog}
                    disabled={session.modelLocked}
                    modelId={session.modelId}
                    onChangeModel={props.changeModel}
                />
                {session.modelLocked && (
                    <p className="text-xs text-muted-foreground">
                        The model is locked for this session.
                    </p>
                )}
            </DetailField>

            <DetailField label="Reasoning effort">
                <EffortSelect
                    disabled={false}
                    effort={session.effort}
                    levels={currentModel?.thinkingLevels ?? []}
                    onChangeEffort={props.changeEffort}
                />
            </DetailField>

            <Separator className="bg-border/60" />

            <div className="grid grid-cols-2 gap-4">
                <DetailField label="Created">
                    <p
                        className="text-xs text-foreground/90"
                        title={summary !== undefined ? exactTime(summary.createdAt) : undefined}
                    >
                        {summary !== undefined
                            ? formatRelativeTime(summary.createdAt)
                            : "Not available yet"}
                    </p>
                </DetailField>
                <DetailField label="Last updated">
                    <p
                        className="text-xs text-foreground/90"
                        title={summary !== undefined ? exactTime(summary.updatedAt) : undefined}
                    >
                        {summary !== undefined
                            ? formatRelativeTime(summary.updatedAt)
                            : "Not available yet"}
                    </p>
                </DetailField>
                <DetailField label="Messages">
                    <p className="text-xs text-foreground/90">{props.messageCount}</p>
                </DetailField>
                <DetailField label="Tool calls">
                    <p className="text-xs text-foreground/90">{props.toolCallCount}</p>
                </DetailField>
            </div>

            <Separator className="bg-border/60" />

            <ResetConversationButton disabled={props.isRunning} onReset={props.reset} />
        </div>
    );
}
