interface PtyEndpoint {
    onData(handler: (data: string) => void): { dispose(): void };
    write(data: string): void;
}

interface TerminalEndpoint {
    onPtyWrite(handler: (data: string) => void): () => void;
    write(data: string): void;
}

export function connectGymTerminal(pty: PtyEndpoint, terminal: TerminalEndpoint): () => void {
    let connected = true;
    const outputSubscription = pty.onData((data) => {
        if (connected) terminal.write(data);
    });
    const removePtyWriteHandler = terminal.onPtyWrite((data) => {
        if (connected) pty.write(data);
    });

    return () => {
        if (!connected) return;
        connected = false;
        outputSubscription.dispose();
        removePtyWriteHandler();
    };
}
