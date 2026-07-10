import { createHash } from "node:crypto";

import { LRUCache } from "lru-cache";

import { getImageProcessor } from "./getImageProcessor.js";
import { ImageProcessingError } from "./ImageProcessingError.js";
import {
    MAX_PROMPT_IMAGE_INPUT_BYTES,
    type PreparedPromptImage,
    type PromptImageMediaType,
} from "./prepareImageForPrompt.js";

export const CLAUDE_IMAGE_MAX_BASE64_BYTES = 5 * 1024 * 1024;
export const CLAUDE_IMAGE_MAX_RAW_BYTES = (CLAUDE_IMAGE_MAX_BASE64_BYTES * 3) / 4;
export const CLAUDE_IMAGE_MAX_DIMENSION = 2000;

const JPEG_QUALITIES = [80, 60, 40, 20] as const;
const IMAGE_CACHE = new LRUCache<string, PreparedPromptImage>({
    max: 32,
    maxSize: 64 * 1024 * 1024,
    sizeCalculation: (image) => image.bytes.length,
});

/** Prepare an image using the same size and dimension policy as Claude Code. */
export async function prepareImageForClaude(bytes: Uint8Array): Promise<PreparedPromptImage> {
    const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (input.length === 0) {
        throw new ImageProcessingError("Image file is empty.");
    }
    if (input.length > MAX_PROMPT_IMAGE_INPUT_BYTES) {
        throw new ImageProcessingError("Image exceeds the supported size limit.");
    }

    const cacheKey = createHash("sha1").update(input).update("claude").digest("hex");
    const cached = IMAGE_CACHE.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const sharp = await getImageProcessor();
        const metadata = await sharp(input, { failOn: "error" }).metadata();
        const width = metadata.width;
        const height = metadata.height;
        if (width === undefined || height === undefined || width < 1 || height < 1) {
            throw new ImageProcessingError("Image dimensions could not be determined.");
        }

        // Metadata alone does not prove the complete image is decodable.
        await sharp(input, { failOn: "error" }).stats();

        const sourceMediaType: PromptImageMediaType | undefined =
            metadata.format === "jpeg"
                ? "image/jpeg"
                : metadata.format === "png"
                  ? "image/png"
                  : metadata.format === "gif"
                    ? "image/gif"
                    : metadata.format === "webp"
                      ? "image/webp"
                      : undefined;
        const scale = Math.min(
            1,
            CLAUDE_IMAGE_MAX_DIMENSION / width,
            CLAUDE_IMAGE_MAX_DIMENSION / height,
        );
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));
        const shouldResize = targetWidth !== width || targetHeight !== height;

        if (
            !shouldResize &&
            input.length <= CLAUDE_IMAGE_MAX_RAW_BYTES &&
            sourceMediaType !== undefined
        ) {
            const prepared: PreparedPromptImage = {
                bytes: input,
                height,
                mediaType: sourceMediaType,
                width,
            };
            IMAGE_CACHE.set(cacheKey, prepared);
            return prepared;
        }

        if (!shouldResize && metadata.format === "png") {
            const compressed = await sharp(input, { failOn: "error" })
                .png({ compressionLevel: 9, palette: true })
                .toBuffer();
            if (compressed.length <= CLAUDE_IMAGE_MAX_RAW_BYTES) {
                const prepared: PreparedPromptImage = {
                    bytes: compressed,
                    height,
                    mediaType: "image/png",
                    width,
                };
                IMAGE_CACHE.set(cacheKey, prepared);
                return prepared;
            }
        }

        if (!shouldResize && input.length > CLAUDE_IMAGE_MAX_RAW_BYTES) {
            for (const quality of JPEG_QUALITIES) {
                const compressed = await sharp(input, { failOn: "error" })
                    .jpeg({ quality })
                    .toBuffer();
                if (compressed.length <= CLAUDE_IMAGE_MAX_RAW_BYTES) {
                    const prepared: PreparedPromptImage = {
                        bytes: compressed,
                        height,
                        mediaType: "image/jpeg",
                        width,
                    };
                    IMAGE_CACHE.set(cacheKey, prepared);
                    return prepared;
                }
            }
        }

        let resizedPipeline = sharp(input, { failOn: "error" }).resize(targetWidth, targetHeight, {
            fit: "inside",
            withoutEnlargement: true,
        });
        let resizedMediaType: PromptImageMediaType;
        if (metadata.format === "jpeg") {
            resizedPipeline = resizedPipeline.jpeg({ quality: 85 });
            resizedMediaType = "image/jpeg";
        } else if (metadata.format === "webp") {
            resizedPipeline = resizedPipeline.webp({ quality: 85 });
            resizedMediaType = "image/webp";
        } else if (metadata.format === "gif") {
            resizedPipeline = resizedPipeline.gif();
            resizedMediaType = "image/gif";
        } else {
            resizedPipeline = resizedPipeline.png();
            resizedMediaType = "image/png";
        }
        const resized = await resizedPipeline.toBuffer();
        if (resized.length <= CLAUDE_IMAGE_MAX_RAW_BYTES) {
            const prepared: PreparedPromptImage = {
                bytes: resized,
                height: targetHeight,
                mediaType: resizedMediaType,
                width: targetWidth,
            };
            IMAGE_CACHE.set(cacheKey, prepared);
            return prepared;
        }

        if (metadata.format === "png") {
            const compressed = await sharp(input, { failOn: "error" })
                .resize(targetWidth, targetHeight, {
                    fit: "inside",
                    withoutEnlargement: true,
                })
                .png({ compressionLevel: 9, palette: true })
                .toBuffer();
            if (compressed.length <= CLAUDE_IMAGE_MAX_RAW_BYTES) {
                const prepared: PreparedPromptImage = {
                    bytes: compressed,
                    height: targetHeight,
                    mediaType: "image/png",
                    width: targetWidth,
                };
                IMAGE_CACHE.set(cacheKey, prepared);
                return prepared;
            }
        }

        for (const quality of JPEG_QUALITIES) {
            const compressed = await sharp(input, { failOn: "error" })
                .resize(targetWidth, targetHeight, {
                    fit: "inside",
                    withoutEnlargement: true,
                })
                .jpeg({ quality })
                .toBuffer();
            if (compressed.length <= CLAUDE_IMAGE_MAX_RAW_BYTES) {
                const prepared: PreparedPromptImage = {
                    bytes: compressed,
                    height: targetHeight,
                    mediaType: "image/jpeg",
                    width: targetWidth,
                };
                IMAGE_CACHE.set(cacheKey, prepared);
                return prepared;
            }
        }

        const fallbackWidth = Math.min(targetWidth, 1000);
        const fallbackHeight = Math.max(
            1,
            Math.round((targetHeight * fallbackWidth) / targetWidth),
        );
        const fallback = await sharp(input, { failOn: "error" })
            .resize(fallbackWidth, fallbackHeight, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({ quality: 20 })
            .toBuffer();
        if (fallback.length > CLAUDE_IMAGE_MAX_RAW_BYTES) {
            throw new ImageProcessingError("Image could not be compressed to Claude's size limit.");
        }

        const prepared: PreparedPromptImage = {
            bytes: fallback,
            height: fallbackHeight,
            mediaType: "image/jpeg",
            width: fallbackWidth,
        };
        IMAGE_CACHE.set(cacheKey, prepared);
        return prepared;
    } catch (error) {
        if (error instanceof ImageProcessingError) {
            throw error;
        }
        throw new ImageProcessingError("Image could not be decoded or normalized for Claude.", {
            cause: error,
        });
    }
}
