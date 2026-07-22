import { createCodexToolSearchIndex } from "./createCodexToolSearchIndex.js";
import { readCodexBedrockDeferredTools } from "./readCodexBedrockDeferredTools.js";
import type { NamespaceTool } from "../providers/types.js";

const DEFAULT_LIMIT = 8;
const searchTexts = {
    spawn_agent:
        "spawn_agent spawn agent subagent sub-agent delegate delegation parallel work worker explorer no-apps fork model reasoning",
    close_agent: "close_agent close shutdown stop agent subagent thread status target",
    resume_agent: "resume_agent resume reopen closed agent subagent thread id target",
    wait_agent: "wait_agent wait agent subagent status final result complete timeout targets",
    send_input:
        "send_input send message existing agent subagent follow up interrupt redirect queue target",
} as const;

const deferred = readCodexBedrockDeferredTools();
const search = createCodexToolSearchIndex(
    deferred.namespace.tools.map((tool) => ({
        searchText: searchTexts[tool.name as keyof typeof searchTexts] ?? tool.description,
        value: tool,
    })),
);

export function searchCodexBedrockDeferredTools(options: {
    limit?: number;
    query: string;
}): readonly NamespaceTool[] {
    const query = options.query.trim();
    if (query.length === 0) throw new Error("query must not be empty");
    const limit = options.limit ?? DEFAULT_LIMIT;
    if (limit === 0) throw new Error("limit must be greater than zero");
    if (!Number.isSafeInteger(limit) || limit < 0)
        throw new Error("limit must be a positive integer");
    const tools = search(query, limit);
    return tools.length === 0 ? [] : [{ ...deferred.namespace, tools }];
}
