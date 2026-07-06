import type { FileUIPart } from "@/components/ai/types";
import type { ImageBlock } from "@/protocol";

/**
 * Converts a PromptInput attachment (whose url is a `data:` URL after submit)
 * into a protocol ImageBlock: media type from the data URL header, base64
 * payload with the `data:*;base64,` prefix stripped. Returns undefined for
 * anything that is not an inline image.
 */
export function fileUiPartToImageBlock(file: FileUIPart): ImageBlock | undefined {
    const url = file.url;
    if (url === undefined || !url.startsWith("data:")) {
        return undefined;
    }
    const commaIndex = url.indexOf(",");
    if (commaIndex < 0) {
        return undefined;
    }
    const header = url.slice("data:".length, commaIndex);
    const mediaType = header.split(";")[0] || file.mediaType || "";
    if (!mediaType.startsWith("image/")) {
        return undefined;
    }
    return { type: "image", mediaType, data: url.slice(commaIndex + 1) };
}
