import type { Bash } from "just-bash";

import type { BashContext } from "./BashContext.js";
import { capOutput } from "./capOutput.js";

export function createJustBashBashContext(
  bash: Bash,
  cwd: string,
): BashContext {
  return {
    cwd,
    async run(runOptions) {
      const controller = new AbortController();
      const timeout =
        runOptions.timeoutMs === undefined
          ? undefined
          : setTimeout(() => controller.abort(), runOptions.timeoutMs);
      const abort = () => controller.abort();
      runOptions.signal?.addEventListener("abort", abort, { once: true });

      try {
        const result = await bash.exec(runOptions.command, {
          cwd: runOptions.cwd ?? cwd,
          signal: controller.signal,
        });
        return {
          stdout: capOutput(result.stdout, runOptions.maxOutputBytes),
          stderr: capOutput(result.stderr, runOptions.maxOutputBytes),
          exitCode: result.exitCode,
          timedOut: controller.signal.aborted,
        };
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        runOptions.signal?.removeEventListener("abort", abort);
      }
    },
  };
}
