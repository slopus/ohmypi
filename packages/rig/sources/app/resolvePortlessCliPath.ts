import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);

export async function resolvePortlessCliPath(): Promise<string> {
    const searchPaths = require.resolve.paths("portless") ?? [];
    for (const searchPath of searchPaths) {
        const packageRoot = join(searchPath, "portless");
        const cliPath = await readPackageCliPath(packageRoot);
        if (cliPath !== undefined) {
            return cliPath;
        }
    }

    throw new Error("Cannot locate the Portless CLI.");
}

async function readPackageCliPath(packageRoot: string): Promise<string | undefined> {
    try {
        const packageJsonPath = join(packageRoot, "package.json");
        const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
            bin?: Record<string, string> | string;
        };
        const binPath =
            typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.portless;
        if (binPath === undefined || binPath.length === 0) {
            return undefined;
        }

        const cliPath = resolve(packageRoot, binPath);
        await access(cliPath);
        return cliPath;
    } catch {
        return undefined;
    }
}
