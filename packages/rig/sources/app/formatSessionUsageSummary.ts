import type { GetSessionUsageResponse, SessionUsageGroup } from "../protocol/index.js";
import type { CodingAssistantModelChoice } from "./CodingAssistantAgentBackend.js";
import { formatCompactTokens } from "./formatCompactTokens.js";

export function formatSessionUsageSummary(
    summary: GetSessionUsageResponse,
    modelChoices: readonly CodingAssistantModelChoice[],
    now = Date.now(),
): string {
    const lines: string[] = [];
    const providerIds = distinct([
        ...summary.groups.map((group) => group.providerId ?? "earlier"),
        summary.currentProviderId,
    ]);

    for (const providerId of providerIds) {
        lines.push(providerName(providerId));
        for (const group of summary.groups.filter(
            (candidate) => (candidate.providerId ?? "earlier") === providerId,
        )) {
            lines.push(formatModelUsage(group, modelChoices));
        }
        if (providerId === summary.currentProviderId) {
            lines.push(formatQuota(summary, now));
            lines.push(formatContext(summary, modelChoices));
        }
    }

    const total = summary.groups.reduce((sum, group) => sum + group.usage.totalTokens, 0);
    lines.push(`Total: ${formatCompactTokens(total)}`);
    return lines.join("\n");
}

function formatModelUsage(
    group: SessionUsageGroup,
    modelChoices: readonly CodingAssistantModelChoice[],
): string {
    const model =
        group.modelId === null
            ? (group.modelLabel ?? "Model unavailable")
            : (modelChoices.find((choice) => choice.model.id === group.modelId)?.model.name ??
              group.modelId);
    return `${model} · ${formatCompactTokens(group.usage.input)} in · ${formatCompactTokens(group.usage.output)} out · ${formatCompactTokens(group.usage.cacheRead)} read · ${formatCompactTokens(group.usage.cacheWrite)} write · ${formatCompactTokens(group.usage.totalTokens)} total`;
}

function formatQuota(summary: GetSessionUsageResponse, now: number): string {
    const quota = summary.quota;
    if (quota?.status !== "available") return "5-hour: unavailable";
    const left = Math.max(0, Math.min(100, Math.round(100 - quota.usedPercent)));
    return `5-hour: ${left}% left · resets in ${formatResetDuration(quota.resetsAt - now)}`;
}

function formatContext(
    summary: GetSessionUsageResponse,
    modelChoices: readonly CodingAssistantModelChoice[],
): string {
    const context = summary.context;
    if (context === undefined) return "Context: unavailable";
    const window = modelChoices.find(
        (choice) =>
            choice.providerId === context.providerId &&
            choice.model.id === context.requestedModelId,
    )?.model.contextWindow;
    const prefix = context.approximate ? "~" : "";
    if (window === undefined)
        return `Context: ${prefix}${formatCompactTokens(context.totalTokens)}`;
    const percentLeft = Math.max(0, Math.round((1 - context.totalTokens / window) * 100));
    return `Context: ${prefix}${formatCompactTokens(context.totalTokens)} / ${formatCompactTokens(window)} · ${percentLeft}% left`;
}

function formatResetDuration(milliseconds: number): string {
    if (milliseconds <= 0) return "now";
    const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${remainingMinutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
}

function providerName(providerId: string): string {
    if (providerId === "codex") return "Codex";
    if (providerId === "claude-sdk") return "Claude";
    if (providerId === "earlier") return "Earlier usage";
    if (providerId === "gym") return "Gym";
    if (providerId === "bedrock") return "Amazon Bedrock";
    return providerId;
}

function distinct(values: readonly string[]): string[] {
    return [...new Set(values)];
}
