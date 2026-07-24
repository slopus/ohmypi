const HEARTBEAT_INTERVAL_MS = 5_000;

export class SessionTerminalConnection {
    readonly connectionId: string;

    #closed = false;
    readonly #disconnect: () => Promise<void>;
    readonly #heartbeat: () => Promise<void>;
    #inFlight: Promise<void> | undefined;
    readonly #setFocused: (focused: boolean) => void;
    readonly #timer: ReturnType<typeof setInterval>;

    constructor(options: {
        connectionId: string;
        disconnect: () => Promise<void>;
        heartbeat: () => Promise<void>;
        heartbeatIntervalMs?: number;
        setFocused: (focused: boolean) => void;
    }) {
        this.connectionId = options.connectionId;
        this.#disconnect = options.disconnect;
        this.#heartbeat = options.heartbeat;
        this.#setFocused = options.setFocused;
        this.#timer = setInterval(
            () => this.#sendHeartbeat(),
            options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS,
        );
        this.#timer.unref?.();
    }

    async close(): Promise<void> {
        if (this.#closed) return;
        this.#closed = true;
        clearInterval(this.#timer);
        await this.#inFlight?.catch(() => undefined);
        await this.#disconnect();
    }

    async setFocused(focused: boolean): Promise<void> {
        if (this.#closed) return;
        this.#setFocused(focused);
        await this.#inFlight;
        if (this.#closed) return;
        this.#sendHeartbeat();
        await this.#inFlight;
    }

    #sendHeartbeat(): void {
        if (this.#closed || this.#inFlight !== undefined) return;
        this.#inFlight = this.#heartbeat()
            .catch(() => undefined)
            .finally(() => {
                this.#inFlight = undefined;
            });
    }
}
