import type { BashSessionActivity } from "../agent/context/BashContext.js";
import type { SubagentSummary, WorkflowRun } from "../protocol/index.js";

export type ActiveWorkItem =
    | {
          id: string;
          kind: "subagent";
          subagent: SubagentSummary;
      }
    | {
          id: string;
          kind: "workflow";
          workflow: WorkflowRun;
      }
    | {
          id: string;
          kind: "process";
          process: BashSessionActivity;
      };
