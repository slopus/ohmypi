interface ContainerRunner {
    runInContainer(
        command: string,
        args: readonly string[],
        options: { timeoutMs?: number },
    ): Promise<unknown>;
}

export async function waitForFile(
    gym: ContainerRunner,
    path: string,
    timeoutMs = 30_000,
): Promise<void> {
    await gym.runInContainer(
        "sh",
        ["-c", 'while [ ! -e "$1" ]; do sleep 0.05; done', "wait-for-file", path],
        { timeoutMs },
    );
}
