import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";
import { quoteVisibleExact } from "../../permissions/quoteVisibleExact.js";
import { shouldReviewPathInAutoMode } from "../../permissions/shouldReviewPathInAutoMode.js";
import { analyzeGeminiMedia, type AnalyzeGeminiMediaOptions } from "./analyzeGeminiMedia.js";
import { resolveGeminiMediaInput } from "./resolveGeminiMediaInput.js";

const MAX_INLINE_MEDIA_BYTES = 15 * 1024 * 1024;

const analyzedMediaSchema = Type.Object({
    analysis: Type.String(),
    mime_type: Type.String(),
    path: Type.String(),
});

export interface GeminiAnalyzeMediaDependencies {
    analyze?: (options: AnalyzeGeminiMediaOptions) => Promise<string>;
}

export function createGeminiAnalyzeMediaTool(
    apiKey: string,
    dependencies: GeminiAnalyzeMediaDependencies = {},
) {
    const analyze = dependencies.analyze ?? analyzeGeminiMedia;
    return defineTool({
        name: "gemini_analyze_media",
        label: "Gemini media analysis",
        description:
            "Analyze a local image, audio, video, or PDF file up to 15 MiB with Gemini 3.5 Flash. Use it to describe, transcribe, summarize, extract details, or answer questions about media.",
        arguments: Type.Object({
            path: Type.String({ description: "Local path to an image, audio, video, or PDF file" }),
            prompt: Type.String({
                minLength: 2,
                description: "Specific analysis, transcription, extraction, or question to perform",
            }),
        }),
        returnType: analyzedMediaSchema,
        requiresAutoOrFullAccess: true,
        describeAutoPermissionAction: ({ path, prompt }) =>
            `uploading ${quoteVisibleExact(path)} to Gemini for ${quoteVisibleExact(prompt)}. Access: local filesystem read and external Gemini API`,
        shouldReviewInAutoMode: () => true,
        shouldRunInFullAccessInAutoMode: ({ path }, context) =>
            shouldReviewPathInAutoMode(path, context, { write: false }),
        execute: async ({ path, prompt }, context, execution) => {
            const resolvedPath = resolveFileSystemPath(path, context.fs.cwd, context.fs.home);
            const stat = await context.fs.stat(resolvedPath);
            if (!stat.isFile) throw new Error(`Gemini media path '${path}' is not a file.`);
            if (stat.size > MAX_INLINE_MEDIA_BYTES) {
                throw new Error("Gemini media analysis supports files up to 15 MiB.");
            }
            const media = resolveGeminiMediaInput(resolvedPath);
            const bytes = await context.fs.readFileBuffer(resolvedPath);
            if (bytes.byteLength > MAX_INLINE_MEDIA_BYTES) {
                throw new Error("Gemini media analysis supports files up to 15 MiB.");
            }
            const analysis = await analyze({
                apiKey,
                bytes,
                mimeType: media.mimeType,
                prompt,
                ...(execution.signal === undefined ? {} : { signal: execution.signal }),
                type: media.type,
            });
            return { analysis, mime_type: media.mimeType, path: resolvedPath };
        },
        toLLM: (result) => [{ type: "text", text: result.analysis }],
        toUI: (result) => `Analyzed ${result.path}`,
        locks: [],
    });
}
