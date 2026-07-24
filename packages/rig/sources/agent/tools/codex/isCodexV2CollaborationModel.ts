export function isCodexV2CollaborationModel(modelId: string, providerName?: string): boolean {
    return (
        providerName !== "bedrock" &&
        (modelId === "openai/gpt-5.6-sol" || modelId === "openai/gpt-5.6-terra")
    );
}
