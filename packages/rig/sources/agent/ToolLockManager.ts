interface PendingToolExecution {
    keys: readonly string[];
    start: () => void;
}

export class ToolLockManager {
    readonly #activeKeys = new Set<string>();
    readonly #pending: PendingToolExecution[] = [];

    run<T>(keys: readonly string[], operation: () => Promise<T> | T): Promise<T> {
        const uniqueKeys = [...new Set(keys)].sort();
        if (uniqueKeys.length === 0) return Promise.resolve().then(operation);

        return new Promise<T>((resolve, reject) => {
            this.#pending.push({
                keys: uniqueKeys,
                start: () => {
                    void Promise.resolve()
                        .then(operation)
                        .then(resolve, reject)
                        .finally(() => {
                            for (const key of uniqueKeys) this.#activeKeys.delete(key);
                            this.#drain();
                        });
                },
            });
            this.#drain();
        });
    }

    #drain(): void {
        for (let index = 0; index < this.#pending.length; ) {
            const pending = this.#pending[index];
            if (pending === undefined) break;
            if (pending.keys.some((key) => this.#activeKeys.has(key))) {
                index++;
                continue;
            }

            this.#pending.splice(index, 1);
            for (const key of pending.keys) this.#activeKeys.add(key);
            pending.start();
        }
    }
}
