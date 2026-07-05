import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { textOutputSchema, toTextBlocks } from "../utils/index.js";

const CLAUDE_WEB_FETCH_DESCRIPTION = `
- Fetches content from a specified URL and processes it using an AI model
- Takes a URL and a prompt as input
- Fetches the URL content, converts HTML to markdown
- Processes the content with the prompt using a small, fast model
- Returns the model's response about the content
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions.
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - The prompt should describe what information you want to extract from the page
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large
  - Includes a self-cleaning 15-minute cache for faster responses when repeatedly accessing the same URL
  - When a URL redirects to a different host, the tool will inform you and provide the redirect URL in a special format. You should then make a new WebFetch request with the redirect URL to fetch the content.
  - For GitHub URLs, prefer using the gh CLI via Bash instead (e.g., gh pr view, gh issue view, gh api).
`;

export const claudeWebFetchTool = defineTool({
    name: "WebFetch",
    label: "WebFetch",
    description: CLAUDE_WEB_FETCH_DESCRIPTION,
    arguments: Type.Object({
        url: Type.String({ description: "The URL to fetch content from" }),
        prompt: Type.String({ description: "The prompt to run on the fetched content" }),
    }),
    returnType: textOutputSchema,
    execute: async ({ url }) => {
        const parsed = new URL(url);
        return {
            text: `Claude wants to fetch content from ${parsed.hostname}`,
        };
    },
    toLLM: toTextBlocks,
    toUI: (result) => result.text,
    locks: [],
});
