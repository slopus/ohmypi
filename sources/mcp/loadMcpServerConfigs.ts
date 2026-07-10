import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadConfig } from "../config/loadConfig.js";
import type { LoadConfigOptions } from "../config/types.js";
import type { McpServerConfig } from "./types.js";

export async function loadMcpServerConfigs(
    cwd: string,
    options: Omit<LoadConfigOptions, "cwd"> = {},
): Promise<Readonly<Record<string, McpServerConfig>>> {
    const loaded = await loadConfig({ ...options, cwd });
    const projectServers = await readProjectMcpConfig(join(cwd, ".mcp.json"));
    return { ...loaded.config.mcpServers, ...projectServers };
}

async function readProjectMcpConfig(
    path: string,
): Promise<Readonly<Record<string, McpServerConfig>>> {
    let source: string;
    try {
        source = await readFile(path, "utf8");
    } catch (error) {
        if (isMissingFileError(error)) return {};
        throw error;
    }

    let document: unknown;
    try {
        document = JSON.parse(source);
    } catch (error) {
        throw new Error(
            `.mcp.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    if (!isRecord(document) || !isRecord(document.mcpServers)) {
        throw new Error('.mcp.json must contain an "mcpServers" object.');
    }

    return Object.fromEntries(
        Object.entries(document.mcpServers).map(([name, value]) => [
            name,
            parseProjectServer(name, value),
        ]),
    );
}

function parseProjectServer(name: string, value: unknown): McpServerConfig {
    if (!isRecord(value)) {
        throw new Error(`MCP server "${name}" must be an object.`);
    }
    const type = typeof value.type === "string" ? value.type : undefined;
    if (type !== undefined && type !== "stdio" && type !== "http") {
        throw new Error(
            `MCP server "${name}" uses unsupported transport "${type}". Use stdio or http.`,
        );
    }
    const common = {
        ...optionalBoolean(value.enabled, "enabled", name),
        ...optionalStringArray(value.enabledTools, "enabledTools", name),
        ...optionalStringArray(value.disabledTools, "disabledTools", name),
        ...optionalPositiveNumber(value.startupTimeoutMs, "startupTimeoutMs", name),
        ...optionalPositiveNumber(value.toolTimeoutMs, "toolTimeoutMs", name),
    };
    if (type === "stdio" || typeof value.command === "string") {
        if (typeof value.command !== "string" || value.command.trim() === "") {
            throw new Error(`MCP server "${name}" must provide a command.`);
        }
        return {
            ...common,
            ...optionalStringArray(value.args, "args", name),
            ...optionalStringRecord(value.env, "env", name),
            ...optionalString(value.cwd, "cwd", name),
            command: value.command,
            transport: "stdio",
        };
    }
    if (type === "http" || typeof value.url === "string") {
        if (typeof value.url !== "string" || value.url.trim() === "") {
            throw new Error(`MCP server "${name}" must provide a URL.`);
        }
        return {
            ...common,
            ...optionalStringRecord(value.headers, "headers", name),
            ...optionalString(value.bearerTokenEnvVar, "bearerTokenEnvVar", name),
            transport: "http",
            url: value.url,
        };
    }
    throw new Error(`MCP server "${name}" must configure either command or url.`);
}

function optionalBoolean(
    value: unknown,
    key: "enabled",
    serverName: string,
): { enabled?: boolean } {
    if (value === undefined) return {};
    if (typeof value !== "boolean") throw invalidField(serverName, key, "a boolean");
    return { enabled: value };
}

function optionalPositiveNumber<TKey extends "startupTimeoutMs" | "toolTimeoutMs">(
    value: unknown,
    key: TKey,
    serverName: string,
): Partial<Record<TKey, number>> {
    if (value === undefined) return {};
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw invalidField(serverName, key, "a positive number");
    }
    return { [key]: value } as Partial<Record<TKey, number>>;
}

function optionalString<TKey extends "bearerTokenEnvVar" | "cwd">(
    value: unknown,
    key: TKey,
    serverName: string,
): Partial<Record<TKey, string>> {
    if (value === undefined) return {};
    if (typeof value !== "string") throw invalidField(serverName, key, "a string");
    return { [key]: value } as Partial<Record<TKey, string>>;
}

function optionalStringArray<TKey extends "args" | "disabledTools" | "enabledTools">(
    value: unknown,
    key: TKey,
    serverName: string,
): Partial<Record<TKey, readonly string[]>> {
    if (value === undefined) return {};
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
        throw invalidField(serverName, key, "an array of strings");
    }
    return { [key]: value } as unknown as Partial<Record<TKey, readonly string[]>>;
}

function optionalStringRecord<TKey extends "env" | "headers">(
    value: unknown,
    key: TKey,
    serverName: string,
): Partial<Record<TKey, Readonly<Record<string, string>>>> {
    if (value === undefined) return {};
    if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== "string")) {
        throw invalidField(serverName, key, "an object with string values");
    }
    return { [key]: value as Record<string, string> } as Partial<
        Record<TKey, Readonly<Record<string, string>>>
    >;
}

function invalidField(serverName: string, key: string, expectation: string): Error {
    return new Error(`MCP server "${serverName}" field "${key}" must be ${expectation}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
    return isRecord(error) && error.code === "ENOENT";
}
