export interface GeminiGeneratedMedia {
    bytes: Uint8Array;
    mimeType: string;
    text?: string;
}

export type GeminiMediaInputType = "audio" | "document" | "image" | "video";

export interface GeminiMediaInput {
    mimeType: string;
    type: GeminiMediaInputType;
}
