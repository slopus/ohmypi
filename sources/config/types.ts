import type { PermissionMode } from "../permissions/index.js";
import type { McpServerConfig } from "../mcp/types.js";

export interface ConfigDefaults {
    effort?: string;
    instructions?: string;
    modelId: string;
    providerId?: string;
    permissionMode: PermissionMode;
}

export interface PartialConfigDefaults {
    effort?: string;
    instructions?: string;
    modelId?: string;
    providerId?: string;
    permissionMode?: PermissionMode;
}

export interface ConfigSettings {
    showReasoning: boolean;
}

export interface PartialConfigSettings {
    showReasoning?: boolean;
}

export interface RigConfig {
    defaults: ConfigDefaults;
    mcpServers: Readonly<Record<string, McpServerConfig>>;
    settings: ConfigSettings;
}

export interface PartialRigConfig {
    defaults?: PartialConfigDefaults;
    mcpServers?: Readonly<Record<string, McpServerConfig>>;
    settings?: PartialConfigSettings;
}

export interface ConfigPaths {
    global: string;
    local: string;
    runtime: string;
}

export interface ConfigSource {
    exists: boolean;
    path: string;
    values: PartialRigConfig;
}

export interface LoadedConfig {
    config: RigConfig;
    paths: ConfigPaths;
    sources: {
        global: ConfigSource;
        local: ConfigSource;
        runtime: ConfigSource;
    };
}

export interface LoadConfigOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    homeDirectory?: string;
}
