export function readGeminiApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
    const apiKey = env.GEMINI_API_KEY?.trim();
    return apiKey || undefined;
}
