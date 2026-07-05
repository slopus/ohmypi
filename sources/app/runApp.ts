import { ProcessTerminal, TUI } from "@earendil-works/pi-tui";

import { loadConfig, writeRuntimeConfig } from "../config/index.js";
import { CodingAssistantApp } from "./CodingAssistantApp.js";
import {
    createCodingAssistantAgent,
    type CreateCodingAssistantAgentOptions,
} from "./createCodingAssistantAgent.js";
import { createStopOnceHandler } from "./createStopOnceHandler.js";
import { readPackageVersion } from "./readPackageVersion.js";

export interface RunAppOptions {
    apiKey?: string;
    cwd?: string;
    effort?: string;
    instructions?: string;
    modelId?: string;
    showReasoning?: boolean;
}

export async function runApp(options: RunAppOptions = {}): Promise<void> {
    const cwd = options.cwd ?? process.cwd();
    const loadedConfig = await loadConfig({ cwd });
    const agentOptions: CreateCodingAssistantAgentOptions = {
        cwd,
        modelId: loadedConfig.config.defaults.modelId,
    };
    if (loadedConfig.config.defaults.effort !== undefined) {
        agentOptions.effort = loadedConfig.config.defaults.effort;
    }
    if (loadedConfig.config.defaults.instructions !== undefined) {
        agentOptions.instructions = loadedConfig.config.defaults.instructions;
    }
    if (options.apiKey !== undefined) agentOptions.apiKey = options.apiKey;
    if (options.effort !== undefined) agentOptions.effort = options.effort;
    if (options.instructions !== undefined) agentOptions.instructions = options.instructions;
    if (options.modelId !== undefined) agentOptions.modelId = options.modelId;
    let showReasoning = options.showReasoning ?? loadedConfig.config.settings.showReasoning;

    const runtime = createCodingAssistantAgent(agentOptions);
    // The app renders a softened fake cursor; keep the terminal cursor hidden
    // so the two blink loops do not compete.
    const tui = new TUI(new ProcessTerminal(), false);
    const app = new CodingAssistantApp({
        agent: runtime.agent,
        cwd: runtime.cwd,
        onDefaultModelChange: (preference) =>
            writeRuntimeConfig(loadedConfig.paths.runtime, {
                defaults: {
                    modelId: preference.modelId,
                    effort: preference.effort,
                },
                settings: {
                    showReasoning,
                },
            }),
        onSettingsChange: (settings) => {
            showReasoning = settings.showReasoning;
            return writeRuntimeConfig(loadedConfig.paths.runtime, {
                defaults: {
                    modelId: runtime.agent.model.id,
                    effort:
                        runtime.agent.snapshot().effort ?? runtime.agent.model.defaultThinkingLevel,
                },
                settings,
            });
        },
        processManager: runtime.processManager,
        showReasoning,
        tui,
        version: readPackageVersion(),
    });

    const requestStop = createStopOnceHandler(
        () => app.stop(),
        (error) => {
            console.error(error);
            process.exitCode = 1;
        },
    );
    const stop = () => {
        void requestStop();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);

    try {
        app.start();
        await app.waitForExit();
    } finally {
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);
        await runtime.processManager.killAll({ forceAfterMs: 500 });
    }
}
