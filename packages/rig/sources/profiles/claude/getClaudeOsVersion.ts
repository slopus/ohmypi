import { release, type, version } from "node:os";

export function getClaudeOsVersion(platform: NodeJS.Platform = process.platform): string {
    return platform === "win32" ? `${version()} ${release()}` : `${type()} ${release()}`;
}
