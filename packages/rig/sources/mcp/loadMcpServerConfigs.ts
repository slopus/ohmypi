import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "../config/loadConfig.js";
import { readConfigFile } from "../config/readConfigFile.js";
import type { LoadConfigOptions } from "../config/types.js";
import type { McpServerConfig } from "./types.js";

export async function loadMcpServerConfigs(
    cwd: string,
    options: Omit<LoadConfigOptions, "cwd"> = {},
): Promise<Readonly<Record<string, McpServerConfig>>> {
    const home = options.homeDirectory ?? homedir();
    const codexGlobal = await readConfigFile(join(home, ".codex", "config.toml"));
    const codexProject = await readConfigFile(join(cwd, ".codex", "config.toml"));
    const loaded = await loadConfig({ ...options, cwd });
    return {
        ...codexGlobal.values.mcpServers,
        ...codexProject.values.mcpServers,
        ...loaded.config.mcpServers,
    };
}
