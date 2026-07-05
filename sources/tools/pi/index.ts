export { piBashTool } from "./bash.js";
export { piEditTool } from "./edit.js";
export { piFindTool } from "./find.js";
export { piGrepTool } from "./grep.js";
export { piLsTool } from "./ls.js";
export { piReadTool } from "./read.js";
export { piWriteTool } from "./write.js";

import { piBashTool } from "./bash.js";
import { piEditTool } from "./edit.js";
import { piFindTool } from "./find.js";
import { piGrepTool } from "./grep.js";
import { piLsTool } from "./ls.js";
import { piReadTool } from "./read.js";
import { piWriteTool } from "./write.js";

export const piTools = [
    piReadTool,
    piBashTool,
    piEditTool,
    piWriteTool,
    piGrepTool,
    piFindTool,
    piLsTool,
] as const;
