import { expect, it } from "vitest";

import { configureSessionRequest } from "./configureSessionRequest.js";
import { SessionConfigurationError } from "./SessionConfigurationError.js";

it("applies the daemon Docker default to remotely created sessions", () => {
    expect(
        configureSessionRequest(
            { cwd: "/workspace", permissionMode: "auto" },
            { image: "node:latest", workingDirectory: "/workspace" },
        ),
    ).toMatchObject({
        cwd: "/workspace",
        docker: { image: "node:latest" },
        permissionMode: "auto",
    });
    expect(
        configureSessionRequest(
            { cwd: "/workspace", local: true, permissionMode: "auto" },
            { image: "node:latest", workingDirectory: "/workspace" },
        ),
    ).not.toHaveProperty("docker");
});

it("classifies conflicting and malformed execution settings as client errors", () => {
    expect(() =>
        configureSessionRequest(
            {
                cwd: "/workspace",
                docker: { image: "node:latest", workingDirectory: "/workspace" },
                local: true,
            },
            undefined,
        ),
    ).toThrow(SessionConfigurationError);
    expect(() =>
        configureSessionRequest(
            {
                cwd: "/workspace",
                docker: { image: "node:latest", workingDirectory: "relative" },
            },
            undefined,
        ),
    ).toThrow(SessionConfigurationError);
});
