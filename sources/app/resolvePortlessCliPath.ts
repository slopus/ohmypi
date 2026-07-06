import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);

export async function resolvePortlessCliPath(): Promise<string> {
    const packageEntryPath = require.resolve("portless");
    const cliPath = resolve(dirname(packageEntryPath), "cli.js");
    await access(cliPath);
    return cliPath;
}
