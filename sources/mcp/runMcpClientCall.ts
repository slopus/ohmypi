import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import type { AgentContext } from "../agent/context/AgentContext.js";

interface ClientCallState {
    context?: AgentContext;
    tail: Promise<void>;
}

const states = new WeakMap<Client, ClientCallState>();

export async function runMcpClientCall<T>(
    client: Client,
    context: AgentContext,
    action: () => Promise<T>,
): Promise<T> {
    const state = states.get(client) ?? { tail: Promise.resolve() };
    states.set(client, state);
    const previous = state.tail;
    let release: () => void = () => {};
    state.tail = new Promise<void>((resolve) => {
        release = resolve;
    });
    await previous;
    state.context = context;
    try {
        return await action();
    } finally {
        delete state.context;
        release();
    }
}

export function getMcpClientAgentContext(client: Client): AgentContext | undefined {
    return states.get(client)?.context;
}
