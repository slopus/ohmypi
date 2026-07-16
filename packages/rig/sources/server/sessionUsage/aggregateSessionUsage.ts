import type { SessionEvent } from "../../protocol/index.js";
import { addUsage } from "./addUsage.js";
import { aggregateQuotaContributions } from "./aggregateQuotaContributions.js";
import {
    type AttributedSessionUsageGroup,
    type SessionContextUsage,
    type SessionUsageGroup,
    type SessionUsageMetadata,
    type SessionUsageSummary,
} from "./types.js";
import { zeroUsage } from "./zeroUsage.js";

interface ActiveModel {
    modelId: string;
    providerId: string;
    requestedModelId: string;
    responseModel?: string;
}

export function aggregateSessionUsage(
    events: readonly SessionEvent[],
    metadata: SessionUsageMetadata,
): SessionUsageSummary {
    if (metadata.type === "subagent") return { groups: [], observedQuota: [] };

    let groups: SessionUsageGroup[] = [];
    let attributedGroupIndexes = new Map<string, number>();
    let activeModel: ActiveModel | undefined;
    let currentContext: SessionContextUsage | undefined;

    for (const event of events) {
        if (event.type === "session_reset") {
            groups = [];
            attributedGroupIndexes = new Map();
            activeModel = {
                modelId: event.data.snapshot.modelId,
                providerId: event.data.snapshot.providerId,
                requestedModelId: event.data.snapshot.modelId,
            };
            currentContext = undefined;
            continue;
        }

        if (event.type === "session_created") {
            activeModel = {
                modelId: event.data.session.modelId,
                providerId: event.data.session.providerId,
                requestedModelId: event.data.session.modelId,
            };
            continue;
        }

        if (event.type === "model_changed" || event.type === "session_rewound") {
            activeModel = {
                modelId: event.data.snapshot.modelId,
                providerId: event.data.snapshot.providerId,
                requestedModelId: event.data.snapshot.modelId,
            };
            currentContext = undefined;
            continue;
        }

        if (
            event.type === "agent_event" &&
            event.data.event.type === "context_compacted" &&
            activeModel !== undefined
        ) {
            currentContext = {
                ...activeModel,
                approximate: true,
                totalTokens: event.data.event.estimatedTokensAfter,
            };
            continue;
        }

        if (event.type !== "agent_message") continue;
        const message = event.data.message;
        if (message.role !== "agent" || message.usage === undefined) continue;

        const hasCompleteAttribution =
            message.providerId !== undefined &&
            message.providerId.trim().length > 0 &&
            message.requestedModelId !== undefined &&
            message.requestedModelId.trim().length > 0;
        if (!hasCompleteAttribution) {
            throw new Error("Persisted inference usage is missing provider or model attribution.");
        }

        const providerId = message.providerId as string;
        const requestedModelId = message.requestedModelId as string;
        const modelId = message.responseModel ?? requestedModelId;
        const groupKey = JSON.stringify([providerId, modelId]);
        let groupIndex = attributedGroupIndexes.get(groupKey);
        if (groupIndex === undefined) {
            const group: AttributedSessionUsageGroup = {
                kind: "attributed",
                modelId,
                providerId,
                requestedModelId,
                ...(message.responseModel === undefined
                    ? {}
                    : { responseModel: message.responseModel }),
                usage: zeroUsage(),
            };
            groupIndex = groups.length;
            attributedGroupIndexes.set(groupKey, groupIndex);
            groups.push(group);
        }
        const group = groups[groupIndex] as AttributedSessionUsageGroup;
        groups[groupIndex] = { ...group, usage: addUsage(group.usage, message.usage) };
        activeModel = {
            modelId,
            providerId,
            requestedModelId,
            ...(message.responseModel === undefined
                ? {}
                : { responseModel: message.responseModel }),
        };
        currentContext = {
            ...activeModel,
            approximate: false,
            totalTokens: message.usage.totalTokens,
        };
    }

    return {
        ...(currentContext === undefined ? {} : { currentContext }),
        groups,
        observedQuota: aggregateQuotaContributions(events),
    };
}
