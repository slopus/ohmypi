export function resolveGeminiApiKey(
    environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
    return environment.GEMINI_API_KEY?.trim() || undefined;
}
