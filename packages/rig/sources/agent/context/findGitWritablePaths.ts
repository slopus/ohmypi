import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, parse, resolve, sep } from "node:path";

export async function findGitWritablePaths(cwd: string): Promise<readonly string[]> {
    const dotGit = await findDotGit(cwd);
    if (dotGit === undefined) return [];

    const metadata = await lstat(dotGit);
    if (metadata.isDirectory()) return [await realpath(dotGit)];
    if (!metadata.isFile()) return [];

    const contents = await readFile(dotGit, "utf8");
    const match = /^gitdir:\s*(.+)\s*$/imu.exec(contents);
    if (match?.[1] === undefined) return [];

    const gitDirectory = await realpath(resolve(dirname(dotGit), match[1]));
    const parts = gitDirectory.split(sep);
    const dotGitIndex = parts.lastIndexOf(".git");
    const metadataKind = parts[dotGitIndex + 1];
    if (dotGitIndex < 0 || (metadataKind !== "worktrees" && metadataKind !== "modules")) return [];
    if (metadataKind === "modules") return [gitDirectory];

    const commonDirectory = await findCommonGitDirectory(gitDirectory);
    const expectedCommonDirectory = parts.slice(0, dotGitIndex + 1).join(sep) || sep;
    return commonDirectory === expectedCommonDirectory
        ? [gitDirectory, commonDirectory]
        : [gitDirectory];
}

async function findDotGit(cwd: string): Promise<string | undefined> {
    let directory = resolve(cwd);
    for (;;) {
        const candidate = join(directory, ".git");
        try {
            await lstat(candidate);
            return candidate;
        } catch {
            const parent = dirname(directory);
            if (parent === directory || directory === parse(directory).root) return undefined;
            directory = parent;
        }
    }
}

async function findCommonGitDirectory(gitDirectory: string): Promise<string | undefined> {
    try {
        const commonDirectory = await realpath(
            resolve(gitDirectory, (await readFile(join(gitDirectory, "commondir"), "utf8")).trim()),
        );
        return commonDirectory;
    } catch {
        return undefined;
    }
}
