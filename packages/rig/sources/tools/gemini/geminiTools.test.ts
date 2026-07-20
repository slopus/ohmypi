import { describe, expect, it, vi } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { createGeminiAnalyzeMediaTool } from "./createGeminiAnalyzeMediaTool.js";
import { createGeminiGenerateImageTool } from "./createGeminiGenerateImageTool.js";
import { createGeminiGenerateMusicTool } from "./createGeminiGenerateMusicTool.js";
import { createGeminiTools } from "./createGeminiTools.js";

describe("universal Gemini media tools", () => {
    it("uses only gemini_ tool names and declares external execution boundaries", () => {
        const tools = createGeminiTools("secret-key");

        expect(tools.map((tool) => tool.name)).toEqual([
            "gemini_search",
            "gemini_generate_image",
            "gemini_generate_music",
            "gemini_analyze_media",
        ]);
        expect(tools.every((tool) => tool.requiresAutoOrFullAccess)).toBe(true);
    });

    it("writes generated images through the agent filesystem", async () => {
        const generate = vi.fn().mockResolvedValue({
            bytes: new Uint8Array([1, 2, 3]),
            mimeType: "image/png",
            text: "Generated description",
        });
        const tool = createGeminiGenerateImageTool("secret-key", { generate });
        const harness = createJustBashToolHarness();

        const result = await harness.runTool(tool, {
            aspect_ratio: "16:9",
            image_size: "2K",
            output_path: "art/generated.png",
            prompt: "A quiet mountain lake",
        });

        expect(result.path).toBe("/workspace/art/generated.png");
        expect(await harness.context.fs.readFileBuffer(result.path)).toEqual(
            new Uint8Array([1, 2, 3]),
        );
        expect(generate).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: "secret-key",
                aspectRatio: "16:9",
                imageSize: "2K",
                prompt: "A quiet mountain lake",
            }),
        );
    });

    it("rejects an unread existing output before spending a generation request", async () => {
        const generate = vi.fn();
        const tool = createGeminiGenerateImageTool("secret-key", { generate });
        const harness = createJustBashToolHarness({
            files: { "/workspace/existing.png": new Uint8Array([9]) },
        });

        await expect(
            harness.runTool(tool, {
                output_path: "existing.png",
                prompt: "A replacement image",
            }),
        ).rejects.toThrow(/has not been read yet/);
        expect(generate).not.toHaveBeenCalled();
    });

    it("writes generated music and defaults to clip mode", async () => {
        const generate = vi.fn().mockResolvedValue({
            bytes: new Uint8Array([4, 5, 6]),
            mimeType: "audio/mp3",
        });
        const tool = createGeminiGenerateMusicTool("secret-key", { generate });
        const harness = createJustBashToolHarness();

        const result = await harness.runTool(tool, {
            output_path: "audio/theme.mp3",
            prompt: "An instrumental game theme",
        });

        expect(result.path).toBe("/workspace/audio/theme.mp3");
        expect(await harness.context.fs.readFileBuffer(result.path)).toEqual(
            new Uint8Array([4, 5, 6]),
        );
        expect(generate).toHaveBeenCalledWith(
            expect.objectContaining({ mode: "clip", prompt: "An instrumental game theme" }),
        );
    });

    it("reads supported local media and returns Gemini's analysis", async () => {
        const analyze = vi.fn().mockResolvedValue("The clip contains a piano melody.");
        const tool = createGeminiAnalyzeMediaTool("secret-key", { analyze });
        const harness = createJustBashToolHarness({
            files: { "/workspace/audio.mp3": new Uint8Array([7, 8, 9]) },
        });

        const result = await harness.runTool(tool, {
            path: "audio.mp3",
            prompt: "Describe this clip",
        });

        expect(result).toEqual({
            analysis: "The clip contains a piano melody.",
            mime_type: "audio/mp3",
            path: "/workspace/audio.mp3",
        });
        expect(analyze).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: "secret-key",
                bytes: new Uint8Array([7, 8, 9]),
                mimeType: "audio/mp3",
                prompt: "Describe this clip",
                type: "audio",
            }),
        );
    });
});
