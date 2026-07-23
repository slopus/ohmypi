import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MACOS_KEYCHAIN_TIMEOUT_MS = 250;

interface ClaudeCodeCredentials {
    claudeAiOauth?: {
        accessToken?: string;
    };
}

export interface ReadClaudeCodeOAuthTokenOptions {
    env?: NodeJS.ProcessEnv;
}

export function getClaudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
    return env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude");
}

export function parseClaudeOAuthAccessToken(value: string): string | undefined {
    try {
        const credentials = JSON.parse(value) as ClaudeCodeCredentials;
        const token = credentials.claudeAiOauth?.accessToken;
        return typeof token === "string" && token.trim().length > 0 ? token : undefined;
    } catch {
        return undefined;
    }
}

export async function readClaudeCodeOAuthToken(
    options: ReadClaudeCodeOAuthTokenOptions = {},
): Promise<string | undefined> {
    const env = options.env ?? process.env;
    if (env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
        return env.CLAUDE_CODE_OAUTH_TOKEN;
    }

    const configDirectory = getClaudeConfigDir(env);

    if (process.platform === "darwin") {
        const keychainToken = await readTokenFromMacOsKeychain(configDirectory, env);
        if (keychainToken !== undefined) {
            return keychainToken;
        }
    }

    try {
        return parseClaudeOAuthAccessToken(
            await readFile(join(configDirectory, ".credentials.json"), "utf8"),
        );
    } catch (error) {
        if (isFileNotFound(error)) {
            return undefined;
        }
        throw error;
    }
}

async function readTokenFromMacOsKeychain(
    configDirectory: string,
    env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
    const defaultDirectory = env.CLAUDE_CONFIG_DIR === undefined;
    const directorySuffix = defaultDirectory
        ? ""
        : `-${createHash("sha256").update(configDirectory).digest("hex").slice(0, 8)}`;
    const oauthSuffix = env.CLAUDE_CODE_CUSTOM_OAUTH_URL ? "-custom-oauth" : "";
    const service = `Claude Code${oauthSuffix}-credentials${directorySuffix}`;
    const account = env.USER ?? userInfo().username;

    try {
        const { stdout } = await execFileAsync(
            "security",
            ["find-generic-password", "-a", account, "-w", "-s", service],
            {
                encoding: "utf8",
                killSignal: "SIGKILL",
                timeout: MACOS_KEYCHAIN_TIMEOUT_MS,
            },
        );
        return parseClaudeOAuthAccessToken(stdout);
    } catch {
        return undefined;
    }
}

function isFileNotFound(error: unknown): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
    );
}
