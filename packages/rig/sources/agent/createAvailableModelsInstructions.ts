import type {
    AvailableSubagentModel,
    DisabledSubagentProvider,
} from "./context/SubagentContext.js";

export function createAvailableModelsInstructions(
    models: readonly AvailableSubagentModel[],
    disabledProviders: readonly DisabledSubagentProvider[] = [],
): string | undefined {
    if (models.length === 0 && disabledProviders.length === 0) return undefined;

    const sections: string[] = [];
    if (models.length > 0) {
        sections.push(
            [
                "# Available models",
                "You can run subagents with any of these models by passing the provider and model ID exactly as shown. The effort value must be one of that model's listed levels:",
                ...models.map((model) => {
                    const efforts = model.effortLevels
                        .map((effort) =>
                            effort === model.defaultEffort ? `${effort} (default)` : effort,
                        )
                        .join(", ");
                    return `- ${model.providerId}: ${model.name} (\`${model.id}\`) — effort levels: ${efforts}`;
                }),
                "",
                "A request that gives you only a bare model or family name—such as Codex, GPT, Opus, or Sonnet—usually means they want you to run that model somehow. When the request can be handled by a subagent, spawn a subagent with the closest available model and provider. This is usually safe to do without asking for confirmation.",
            ].join("\n"),
        );
    }
    if (disabledProviders.length > 0) {
        sections.push(
            [
                "# Disabled providers",
                "These providers cannot be used in this daemon session. Do not try to use or suggest models from them:",
                ...disabledProviders.map(
                    (provider) =>
                        `- ${provider.id}: ${disabledProviderExplanation(provider.reason)}`,
                ),
            ].join("\n"),
        );
    }
    return sections.join("\n\n");
}

function disabledProviderExplanation(reason: DisabledSubagentProvider["reason"]): string {
    if (reason === "not_enabled") return "disabled in configuration";
    if (reason === "not_authenticated") return "no local authentication was found";
    return "no models are available after applying configuration and regional availability";
}
