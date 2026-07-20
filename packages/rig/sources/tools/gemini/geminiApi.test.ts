import { describe, expect, it, vi } from "vitest";

import { analyzeGeminiMedia } from "./analyzeGeminiMedia.js";
import { generateGeminiImage } from "./generateGeminiImage.js";
import { generateGeminiMusic } from "./generateGeminiMusic.js";

describe("Gemini media APIs", () => {
    it("generates a configured PNG image through the Interactions API", async () => {
        const request = vi.fn().mockResolvedValue(
            jsonResponse({
                steps: [
                    {
                        type: "model_output",
                        content: [
                            { type: "text", text: "A moonlit harbor." },
                            { type: "image", mime_type: "image/png", data: "AQID" },
                        ],
                    },
                ],
            }),
        );

        const result = await generateGeminiImage({
            apiKey: "secret-key",
            aspectRatio: "16:9",
            fetch: request,
            imageSize: "2K",
            prompt: "A moonlit harbor",
        });

        expect(result).toEqual({
            bytes: Buffer.from([1, 2, 3]),
            mimeType: "image/png",
            text: "A moonlit harbor.",
        });
        expect(requestBody(request)).toMatchObject({
            input: "A moonlit harbor",
            model: "gemini-3.1-flash-image",
            response_format: {
                aspect_ratio: "16:9",
                image_size: "2K",
                mime_type: "image/png",
                type: "image",
            },
        });
    });

    it("selects Lyria Clip or Pro and parses MP3 output with lyrics", async () => {
        const request = vi.fn().mockResolvedValue(
            jsonResponse({
                steps: [
                    {
                        type: "model_output",
                        content: [
                            { type: "text", text: "[Verse]\nHello" },
                            { type: "audio", mime_type: "audio/mp3", data: "BAUG" },
                        ],
                    },
                ],
            }),
        );

        const result = await generateGeminiMusic({
            apiKey: "secret-key",
            fetch: request,
            mode: "song",
            prompt: "A hopeful synth-pop song",
        });

        expect(result).toEqual({
            bytes: Buffer.from([4, 5, 6]),
            mimeType: "audio/mp3",
            text: "[Verse]\nHello",
        });
        const body = requestBody(request);
        expect(body).toMatchObject({
            input: "A hopeful synth-pop song",
            model: "lyria-3-pro-preview",
        });
        expect(body).not.toHaveProperty("response_format");
    });

    it("analyzes inline media without putting the key in the request body", async () => {
        const request = vi.fn().mockResolvedValue(
            jsonResponse({
                steps: [
                    {
                        type: "model_output",
                        content: [{ type: "text", text: "A short piano recording." }],
                    },
                ],
            }),
        );

        const result = await analyzeGeminiMedia({
            apiKey: "secret-key",
            bytes: new Uint8Array([7, 8, 9]),
            fetch: request,
            mimeType: "audio/mp3",
            prompt: "Describe this recording",
            type: "audio",
        });

        expect(result).toBe("A short piano recording.");
        const body = requestBody(request);
        expect(body).toMatchObject({
            input: [
                { data: "BwgJ", mime_type: "audio/mp3", type: "audio" },
                { text: "Describe this recording", type: "text" },
            ],
            model: "gemini-3.5-flash",
        });
        expect(JSON.stringify(body)).not.toContain("secret-key");
    });
});

function jsonResponse(value: unknown): Response {
    return new Response(JSON.stringify(value), { status: 200 });
}

function requestBody(request: ReturnType<typeof vi.fn>): Record<string, unknown> {
    const init = request.mock.calls[0]?.[1] as RequestInit | undefined;
    return JSON.parse(String(init?.body)) as Record<string, unknown>;
}
