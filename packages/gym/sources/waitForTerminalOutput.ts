interface TerminalOutputSource {
    onOutput(handler: (data: string) => void): () => void;
}

export function waitForTerminalOutput(
    gym: { terminal: TerminalOutputSource },
    text: string,
    timeoutMs: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        let output = "";
        const retainedLength = Math.max(text.length - 1, 0);
        const stop = gym.terminal.onOutput((data) => {
            const candidate = output + data;
            if (!candidate.includes(text)) {
                output = retainedLength === 0 ? "" : candidate.slice(-retainedLength);
                return;
            }
            clearTimeout(timer);
            stop();
            resolve();
        });
        const timer = setTimeout(() => {
            stop();
            reject(new Error(`Timed out waiting for terminal output ${JSON.stringify(text)}.`));
        }, timeoutMs);
    });
}
