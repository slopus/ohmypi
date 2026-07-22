import { createCodeMode } from "./createCodeMode.js";
import type { CodeModeRunResult, RunCodeOptions } from "./types.js";

export async function runCode(
    source: string,
    options: RunCodeOptions = {},
): Promise<CodeModeRunResult> {
    const {
        binaryPath,
        env,
        onCellClosed,
        onNotification,
        sandbox,
        sessionId,
        tools,
        ...runOptions
    } = options;
    const codeMode = await createCodeMode({
        ...(binaryPath === undefined ? {} : { binaryPath }),
        ...(env === undefined ? {} : { env }),
        ...(sandbox === undefined ? {} : { sandbox }),
    });
    try {
        const session = await codeMode.createSession({
            ...(onCellClosed === undefined ? {} : { onCellClosed }),
            ...(onNotification === undefined ? {} : { onNotification }),
            ...(sessionId === undefined ? {} : { sessionId }),
            ...(tools === undefined ? {} : { tools }),
        });
        return await session.run(source, runOptions);
    } finally {
        await codeMode.close();
    }
}
