import type sharp from "sharp";

let imageProcessor: typeof sharp | undefined;

export async function getImageProcessor(): Promise<typeof sharp> {
    if (imageProcessor !== undefined) {
        return imageProcessor;
    }

    const imported = await import("sharp");
    imageProcessor = imported.default;
    return imageProcessor;
}
