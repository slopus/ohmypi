import { spawn } from "node:child_process";

export function killProcessTree(
  pid: number,
  signal: NodeJS.Signals = "SIGTERM",
): void {
  if (process.platform === "win32") {
    try {
      const args =
        signal === "SIGKILL"
          ? ["/F", "/T", "/PID", String(pid)]
          : ["/T", "/PID", String(pid)];
      const killer = spawn("taskkill", args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      killer.unref();
    } catch {
      // The process may already be gone.
    }
    return;
  }

  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process may already be gone.
    }
  }
}
