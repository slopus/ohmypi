export interface BashRunOptions {
    command: string;
    cwd?: string;
    timeoutMs?: number;
    maxOutputBytes?: number;
    signal?: AbortSignal;
}

export interface BashRunResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
}

export interface BashContext {
    cwd: string;
    run(options: BashRunOptions): Promise<BashRunResult>;
}
