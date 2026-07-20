import { createGeminiSearchTool } from "../webSearch/createGeminiSearchTool.js";
import { createGeminiAnalyzeMediaTool } from "./createGeminiAnalyzeMediaTool.js";
import { createGeminiGenerateImageTool } from "./createGeminiGenerateImageTool.js";
import { createGeminiGenerateMusicTool } from "./createGeminiGenerateMusicTool.js";

export function createGeminiTools(apiKey: string) {
    return [
        createGeminiSearchTool(apiKey),
        createGeminiGenerateImageTool(apiKey),
        createGeminiGenerateMusicTool(apiKey),
        createGeminiAnalyzeMediaTool(apiKey),
    ] as const;
}
