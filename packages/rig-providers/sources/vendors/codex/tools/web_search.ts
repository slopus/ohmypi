import { Type } from "@sinclair/typebox";

import type { SessionTool } from "@/core/SessionTool.js";

export const web_search = {
    name: "web_search",
    type: "cloud",
} as const satisfies SessionTool;
