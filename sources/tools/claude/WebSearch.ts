import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { textOutputSchema, toTextBlocks } from "../utils/index.js";

const CLAUDE_WEB_SEARCH_DESCRIPTION = `
- Allows Claude to search the web and use the results to inform responses
- Provides up-to-date information for current events and recent data
- Returns search result information formatted as search result blocks, including links as markdown hyperlinks
- Use this tool for accessing information beyond Claude's knowledge cutoff
- Searches are performed automatically within a single API call

CRITICAL REQUIREMENT - You MUST follow this:
  - After answering the user's question, you MUST include a "Sources:" section at the end of your response
  - In the Sources section, list all relevant URLs from the search results as markdown hyperlinks: [Title](URL)
  - This is MANDATORY - never skip including sources in your response
  - Example format:

    [Your answer here]

    Sources:
    - [Source Title 1](https://example.com/1)
    - [Source Title 2](https://example.com/2)

Usage notes:
  - Domain filtering is supported to include or block specific websites
  - Web search is only available in the US

IMPORTANT - Use the correct year in search queries:
  - The current month is July 2026. You MUST use this year when searching for recent information, documentation, or current events.
  - Example: If the user asks for "latest React docs", search for "React documentation" with the current year, NOT last year
`;

export const claudeWebSearchTool = defineTool({
  name: "WebSearch",
  label: "WebSearch",
  description: CLAUDE_WEB_SEARCH_DESCRIPTION,
  arguments: Type.Object({
    query: Type.String({ description: "The search query to use" }),
    allowed_domains: Type.Optional(Type.Array(Type.String(), { description: "Only include search results from these domains" })),
    blocked_domains: Type.Optional(Type.Array(Type.String(), { description: "Never include search results from these domains" })),
  }),
  returnType: textOutputSchema,
  execute: async ({ query, allowed_domains, blocked_domains }) => {
    if (allowed_domains !== undefined && blocked_domains !== undefined) {
      throw new Error("Error: Cannot specify both allowed_domains and blocked_domains in the same request");
    }
    return { text: `Claude wants to search the web for: ${query}` };
  },
  toLLM: toTextBlocks,
  toUI: (result) => result.text,
  locks: [],
});
