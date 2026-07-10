import { createHash } from "node:crypto";

import { LRUCache } from "lru-cache";

import { getImageProcessor } from "./getImageProcessor.js";
import { ImageProcessingError } from "./ImageProcessingError.js";
import {
    promptImageOutputDimensions,
    type PromptImageResizeLimits,
} from "./promptImageOutputDimensions.js";

export const IMAGE_PROCESSING_ERROR_PLACEHOLDER =
    "image content omitted because it could not be processed";
export const MAX_PROMPT_IMAGE_INPUT_BYTES = 32 * 1024 * 1024;

const HIGH_DETAIL_LIMITS: PromptImageResizeLimits = {
    maxDimension: 2048,
    maxPatches: 2_500,
};
const ORIGINAL_DETAIL_LIMITS: PromptImageResizeLimits = {
    maxDimension: 6000,
    maxPatches: 10_000,
};
const IMAGE_CACHE = new LRUCache<string, PreparedPromptImage>({
    max: 32,
    maxSize: 64 * 1024 * 1024,
    sizeCalculation: (image) => image.bytes.length,
});

export type PromptImageDetail = "high" | "original";
export type PromptImageMediaType = "image/gif" | "image/jpeg" | "image/png" | "image/webp";

export interface PreparedPromptImage {
    bytes: Buffer;
    height: number;
    mediaType: PromptImageMediaType;
    width: number;
}

export async function prepareImageForPrompt(
    bytes: Uint8Array,
    detail: PromptImageDetail,
): Promise<PreparedPromptImage> {
    const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (input.length === 0) {
        throw new ImageProcessingError("Image file is empty.");
    }
    if (input.length > MAX_PROMPT_IMAGE_INPUT_BYTES) {
        throw new ImageProcessingError("Image exceeds the supported size limit.");
    }
    const cacheKey = createHash("sha1").update(input).update(detail).digest("hex");
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

        const sourceFormat = metadata.format;
        const preservableMediaType =
            sourceFormat === "jpeg"
                ? "image/jpeg"
                : sourceFormat === "png"
                  ? "image/png"
                  : sourceFormat === "webp"
                    ? "image/webp"
                    : undefined;

        const limits = detail === "original" ? ORIGINAL_DETAIL_LIMITS : HIGH_DETAIL_LIMITS;
        const target = promptImageOutputDimensions(width, height, limits);
        const shouldResize = target.width !== width || target.height !== height;

        if (!shouldResize && preservableMediaType !== undefined) {
            await sharp(input, { failOn: "error" }).stats();
            const prepared: PreparedPromptImage = {
                bytes: input,
                height,
                mediaType: preservableMediaType,
                width,
            };
            IMAGE_CACHE.set(cacheKey, prepared);
            return prepared;
        }

        let pipeline = sharp(input, { failOn: "error" });
        if (shouldResize) {
            pipeline = pipeline.resize(target.width, target.height, {
                fit: "fill",
                kernel: sharp.kernel.linear,
            });
        }
        // Match Codex: keep EXIF orientation paired with unrotated pixels instead of baking it in.
        pipeline = pipeline.keepMetadata();

        const outputMediaType = preservableMediaType ?? "image/png";
        if (outputMediaType === "image/jpeg") {
            pipeline = pipeline.jpeg({ quality: 85 });
        } else if (outputMediaType === "image/webp") {
            pipeline = pipeline.webp({ lossless: true });
        } else {
            pipeline = pipeline.png();
        }

        const prepared: PreparedPromptImage = {
            bytes: await pipeline.toBuffer(),
            height: target.height,
            mediaType: outputMediaType,
            width: target.width,
        };
        IMAGE_CACHE.set(cacheKey, prepared);
        return prepared;
    } catch (error) {
        if (error instanceof ImageProcessingError) {
            throw error;
        }
        throw new ImageProcessingError("Image could not be decoded or normalized.", {
            cause: error,
        });
    }
}
