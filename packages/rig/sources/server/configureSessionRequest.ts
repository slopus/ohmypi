import type { CreateSessionRequest } from "../protocol/index.js";
import {
    resolveDockerExecutionConfig,
    validateDockerExecutionConfig,
    type DockerExecutionConfig,
} from "../execution/index.js";
import { SessionConfigurationError } from "./SessionConfigurationError.js";

export function configureSessionRequest(
    request: CreateSessionRequest,
    defaultDocker: DockerExecutionConfig | undefined,
): CreateSessionRequest {
    if (request.local === true && request.docker !== undefined) {
        throw new SessionConfigurationError(
            "Choose either local execution or a Docker environment, not both.",
        );
    }
    const { local: _local, ...configured } = request;
    const docker = request.docker ?? (request.local === true ? undefined : defaultDocker);
    if (docker !== undefined) {
        try {
            validateDockerExecutionConfig(docker);
            configured.docker = resolveDockerExecutionConfig(docker, request.cwd);
        } catch (error) {
            throw new SessionConfigurationError(
                error instanceof Error ? error.message : "The Docker settings are invalid.",
            );
        }
    }
    return configured;
}
