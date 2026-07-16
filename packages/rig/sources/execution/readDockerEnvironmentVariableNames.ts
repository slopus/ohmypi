import type Dockerode from "dockerode";

export async function readDockerEnvironmentVariableNames(
    container: Dockerode.Container,
): Promise<readonly string[]> {
    const details = await container.inspect();
    return (details.Config.Env ?? []).map((entry) => {
        const separator = entry.indexOf("=");
        return separator === -1 ? entry : entry.slice(0, separator);
    });
}
