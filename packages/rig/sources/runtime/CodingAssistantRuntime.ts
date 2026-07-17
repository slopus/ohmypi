import type { Agent, AgentContext } from "../agent/index.js";
import type { NativeProcessManager } from "../processes/index.js";
import type { Provider } from "../providers/types.js";

export interface CodingAssistantRuntime {
    agent: Agent;
    context: AgentContext;
    cwd: string;
    processManager: NativeProcessManager;
    provider: Provider;
}
