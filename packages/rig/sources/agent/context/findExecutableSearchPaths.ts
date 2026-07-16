import { homedir, tmpdir } from "node:os";
import { delimiter, isAbsolute, sep } from "node:path";

import { createSensitiveReadPaths } from "./createSensitiveReadPaths.js";
import { resolvePotentialPath } from "./resolvePotentialPath.js";

const DEFAULT_UNIX_PATHS = [
    "/opt/homebrew/bin",
    "/usr/local/sbin",
    "/usr/local/bin",
    "/usr/sbin",
    "/usr/bin",
    "/sbin",
    "/bin",
] as const;
const COMMON_TEMPORARY_DIRECTORIES = ["/tmp", "/var/tmp", "/private/tmp"] as const;

export async function findExecutableSearchPaths(options: {
    cwd: string;
    environment?: NodeJS.ProcessEnv;
    homeDirectory?: string;
    temporaryDirectory?: string;
}): Promise<readonly string[]> {
    const environment = options.environment ?? process.env;
    const homeDirectory = options.homeDirectory ?? homedir();
    const temporaryDirectory = options.temporaryDirectory ?? tmpdir();
    const candidates = [
        ...(environment.PATH?.split(delimiter) ?? []),
        ...DEFAULT_UNIX_PATHS,
    ].filter((path) => path.length > 0 && isAbsolute(path));
    const writableRoots = await Promise.all(
        [options.cwd, temporaryDirectory, ...COMMON_TEMPORARY_DIRECTORIES].map((path) =>
            resolvePotentialPath(path),
        ),
    );
    const sensitivePaths = await Promise.all(
        createSensitiveReadPaths({
            environment,
            homeDirectory,
            temporaryDirectory,
        })
            .filter((path) => path !== homeDirectory)
            .map((path) => resolvePotentialPath(path)),
    );
    const canonicalCandidates = await Promise.all(
        candidates.map((path) => resolvePotentialPath(path)),
    );
    const selected: string[] = [];
    for (const path of canonicalCandidates) {
        const modelWritable = writableRoots.some(
            (root) => path === root || path.startsWith(`${root}${sep}`),
        );
        const exposesSensitiveFiles = sensitivePaths.some(
            (sensitive) =>
                path === sensitive ||
                path.startsWith(`${sensitive}${sep}`) ||
                sensitive.startsWith(`${path}${sep}`),
        );
        if (!modelWritable && !exposesSensitiveFiles && !selected.includes(path)) {
            selected.push(path);
        }
    }
    return selected;
}
