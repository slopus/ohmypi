import { readFile } from "node:fs/promises";

export async function readCodexAccessToken(path: string): Promise<string | undefined> {
    try {
        const data = JSON.parse(await readFile(path, "utf8")) as {
            tokens?: { access_token?: unknown };
        };
        const token = data.tokens?.access_token;
        return typeof token === "string" && token.trim().length > 0 ? token : undefined;
    } catch {
        return undefined;
    }
}
