export function readBedrockBearerToken(
    env: NodeJS.ProcessEnv = process.env,
    bearerTokenEnvVar = "AWS_BEARER_TOKEN_BEDROCK",
): string | undefined {
    const token = env[bearerTokenEnvVar];
    return token !== undefined && token.trim().length > 0 ? token : undefined;
}
