import { extname } from "node:path";

import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { quoteVisibleExact } from "../../permissions/quoteVisibleExact.js";
import { shouldReviewPathInAutoMode } from "../../permissions/shouldReviewPathInAutoMode.js";
import { generateGeminiImage, type GenerateGeminiImageOptions } from "./generateGeminiImage.js";
import { prepareGeneratedMediaOutputPath } from "./prepareGeneratedMediaOutputPath.js";
import type { GeminiGeneratedMedia } from "./types.js";
import { writeGeneratedMediaFile } from "./writeGeneratedMediaFile.js";

const generatedImageSchema = Type.Object({
    bytes: Type.Number(),
    description: Type.Optional(Type.String()),
    mime_type: Type.String(),
    path: Type.String(),
});

export interface GeminiGenerateImageDependencies {
    generate?: (options: GenerateGeminiImageOptions) => Promise<GeminiGeneratedMedia>;
}

export function createGeminiGenerateImageTool(
    apiKey: string,
    dependencies: GeminiGenerateImageDependencies = {},
) {
    const generate = dependencies.generate ?? generateGeminiImage;
    return defineTool({
        name: "gemini_generate_image",
        label: "Gemini image generation",
        description:
            "Generate a new PNG image with Gemini 3.1 Flash Image and save it to the local filesystem. Use a detailed visual prompt and an output path ending in .png.",
        arguments: Type.Object({
            prompt: Type.String({ minLength: 2, description: "Detailed image generation prompt" }),
            output_path: Type.String({ description: "Local output path ending in .png" }),
            aspect_ratio: Type.Optional(
                Type.Union(
                    [
                        Type.Literal("1:1"),
                        Type.Literal("2:3"),
                        Type.Literal("3:2"),
                        Type.Literal("3:4"),
                        Type.Literal("4:3"),
                        Type.Literal("4:5"),
                        Type.Literal("5:4"),
                        Type.Literal("9:16"),
                        Type.Literal("16:9"),
                        Type.Literal("1:4"),
                        Type.Literal("4:1"),
                        Type.Literal("1:8"),
                        Type.Literal("8:1"),
                    ],
                    { description: "Optional generated image aspect ratio" },
                ),
            ),
            image_size: Type.Optional(
                Type.Union(
                    [
                        Type.Literal("0.5K"),
                        Type.Literal("1K"),
                        Type.Literal("2K"),
                        Type.Literal("4K"),
                    ],
                    { description: "Optional generated image resolution; defaults to 1K" },
                ),
            ),
        }),
        returnType: generatedImageSchema,
        requiresAutoOrFullAccess: true,
        describeAutoPermissionAction: ({ prompt, output_path }) =>
            `sending ${quoteVisibleExact(prompt)} to Gemini image generation and writing ${quoteVisibleExact(output_path)}. Access: external Gemini API and local filesystem write`,
        shouldReviewInAutoMode: () => true,
        shouldRunInFullAccessInAutoMode: ({ output_path }, context) =>
            shouldReviewPathInAutoMode(output_path, context, { write: true }),
        execute: async ({ prompt, output_path, aspect_ratio, image_size }, context, execution) => {
            if (extname(output_path).toLowerCase() !== ".png") {
                throw new Error("Gemini image output_path must end in .png.");
            }
            const resolvedOutputPath = await prepareGeneratedMediaOutputPath(output_path, context);
            const generated = await generate({
                apiKey,
                ...(aspect_ratio === undefined ? {} : { aspectRatio: aspect_ratio }),
                ...(image_size === undefined ? {} : { imageSize: image_size }),
                prompt,
                ...(execution.signal === undefined ? {} : { signal: execution.signal }),
            });
            if (generated.mimeType !== "image/png") {
                throw new Error(`Gemini returned unsupported image type '${generated.mimeType}'.`);
            }
            const path = await writeGeneratedMediaFile(
                resolvedOutputPath,
                generated.bytes,
                context,
            );
            return {
                bytes: generated.bytes.byteLength,
                ...(generated.text === undefined ? {} : { description: generated.text }),
                mime_type: generated.mimeType,
                path,
            };
        },
        toLLM: (result) => [
            {
                type: "text",
                text: `Generated image at ${result.path} (${String(result.bytes)} bytes).${result.description === undefined ? "" : `\n\n${result.description}`}`,
            },
        ],
        toUI: (result) => `Generated image at ${result.path}`,
        locks: [(args) => args.output_path],
    });
}
