export function humanizeModelId(modelId: string): string {
    const shortName = modelId.includes("/") ? (modelId.split("/").at(-1) ?? modelId) : modelId;
    return shortName
        .replace(/[-_]+/g, " ")
        .replace(/\bgpt\b/gi, "GPT")
        .replace(/\bapi\b/gi, "API")
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}
