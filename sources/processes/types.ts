export type ManagedProcessStatus = "running" | "exited" | "killed";

export interface ProcessStartOptions {
  command: string;
  cwd: string;
  shell?: string;
  env?: NodeJS.ProcessEnv;
  maxOutputBytes?: number;
  cleanupProcessGroupOnExit?: boolean;
}

export interface ProcessRunOptions extends ProcessStartOptions {
  timeoutMs?: number;
  killGraceMs?: number;
  signal?: AbortSignal;
}

export interface ProcessKillOptions {
  forceAfterMs?: number;
}

export interface ProcessSnapshot {
  id: string;
  pid: number | null;
  command: string;
  cwd: string;
  status: ManagedProcessStatus;
  stdout: string;
  stderr: string;
}

export interface ProcessRunResult extends ProcessSnapshot {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  aborted: boolean;
  killed: boolean;
}
