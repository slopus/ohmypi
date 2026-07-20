import { extname } from "node:path";

import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { quoteVisibleExact } from "../../permissions/quoteVisibleExact.js";
import { shouldReviewPathInAutoMode } from "../../permissions/shouldReviewPathInAutoMode.js";
import { generateGeminiMusic, type GenerateGeminiMusicOptions } from "./generateGeminiMusic.js";
import { prepareGeneratedMediaOutputPath } from "./prepareGeneratedMediaOutputPath.js";
import type { GeminiGeneratedMedia } from "./types.js";
import { writeGeneratedMediaFile } from "./writeGeneratedMediaFile.js";

const generatedMusicSchema = Type.Object({
    bytes: Type.Number(),
    lyrics: Type.Optional(Type.String()),
    mime_type: Type.String(),
    path: Type.String(),
});

export interface GeminiGenerateMusicDependencies {
    generate?: (options: GenerateGeminiMusicOptions) => Promise<GeminiGeneratedMedia>;
}

export function createGeminiGenerateMusicTool(
    apiKey: string,
    dependencies: GeminiGenerateMusicDependencies = {},
) {
    const generate = dependencies.generate ?? generateGeminiMusic;
    return defineTool({
        name: "gemini_generate_music",
        label: "Gemini music generation",
        description:
            "Generate MP3 music with Lyria 3 and save it locally. Clip mode creates a 30-second preview; song mode creates a longer full song and may cost more.",
        arguments: Type.Object({
            prompt: Type.String({
                minLength: 2,
                description:
                    "Music prompt describing style, instruments, mood, structure, and lyrics",
            }),
            output_path: Type.String({ description: "Local output path ending in .mp3" }),
            mode: Type.Optional(
                Type.Union([Type.Literal("clip"), Type.Literal("song")], {
                    description: "Defaults to clip; song generates a longer full-length track",
                }),
            ),
        }),
        returnType: generatedMusicSchema,
        requiresAutoOrFullAccess: true,
        describeAutoPermissionAction: ({ prompt, output_path }) =>
            `sending ${quoteVisibleExact(prompt)} to Gemini music generation and writing ${quoteVisibleExact(output_path)}. Access: external Gemini API and local filesystem write`,
        shouldReviewInAutoMode: () => true,
        shouldRunInFullAccessInAutoMode: ({ output_path }, context) =>
            shouldReviewPathInAutoMode(output_path, context, { write: true }),
        execute: async ({ prompt, output_path, mode }, context, execution) => {
            if (extname(output_path).toLowerCase() !== ".mp3") {
                throw new Error("Gemini music output_path must end in .mp3.");
            }
            const resolvedOutputPath = await prepareGeneratedMediaOutputPath(output_path, context);
            const generated = await generate({
                apiKey,
                mode: mode ?? "clip",
                prompt,
                ...(execution.signal === undefined ? {} : { signal: execution.signal }),
            });
            if (!["audio/mp3", "audio/mpeg"].includes(generated.mimeType)) {
                throw new Error(`Gemini returned unsupported music type '${generated.mimeType}'.`);
            }
            const path = await writeGeneratedMediaFile(
                resolvedOutputPath,
                generated.bytes,
                context,
            );
            return {
                bytes: generated.bytes.byteLength,
                ...(generated.text === undefined ? {} : { lyrics: generated.text }),
                mime_type: generated.mimeType,
                path,
            };
        },
        toLLM: (result) => [
            {
                type: "text",
                text: `Generated music at ${result.path} (${String(result.bytes)} bytes).${result.lyrics === undefined ? "" : `\n\nLyrics and structure:\n${result.lyrics}`}`,
            },
        ],
        toUI: (result) => `Generated music at ${result.path}`,
        locks: [(args) => args.output_path],
    });
}
