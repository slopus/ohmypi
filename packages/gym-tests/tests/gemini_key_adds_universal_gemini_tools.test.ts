import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("universal Gemini tools", () => {
    it("adds every Gemini tool without embedding its credential in inference requests", async () => {
        const apiKey = "gym-gemini-key-must-stay-private";
        const gym = await createGym({
            environment: { GEMINI_API_KEY: apiKey },
            inference(request) {
                expect(request.context.tools?.map((tool) => tool.name)).toEqual(
                    expect.arrayContaining([
                        "gemini_search",
                        "gemini_generate_image",
                        "gemini_generate_music",
                        "gemini_analyze_media",
                    ]),
                );
                expect(JSON.stringify(request)).not.toContain(apiKey);
                return { content: [{ text: "WEB_SEARCH_AVAILABLE", type: "text" }] };
            },
        });
        running.add(gym);

        gym.terminal.type("Confirm whether web search is available.");
        gym.terminal.press("enter");

        const screen = await gym.terminal.waitForText("WEB_SEARCH_AVAILABLE", 30_000);
        expect(screen.text).toContain("WEB_SEARCH_AVAILABLE");
        expect(screen.text).not.toContain(apiKey);
    });

    it("dispatches a Gemini generation tool and reports validation failures", async () => {
        const gym = await createGym({
            environment: { GEMINI_API_KEY: "gym-gemini-key" },
            inference(request, callIndex) {
                if (callIndex === 0) {
                    return {
                        content: [
                            {
                                arguments: {
                                    output_path: "generated.jpg",
                                    prompt: "A geometric landscape",
                                },
                                id: "generate-image",
                                name: "gemini_generate_image",
                                type: "toolCall",
                            },
                        ],
                    };
                }
                expect(request.context.messages.at(-1)).toMatchObject({
                    isError: true,
                    role: "toolResult",
                    toolName: "gemini_generate_image",
                });
                return { content: [{ text: "GEMINI_VALIDATION_VISIBLE", type: "text" }] };
            },
        });
        running.add(gym);

        gym.terminal.type("Generate an image.");
        gym.terminal.press("enter");

        const screen = await gym.terminal.waitForText("GEMINI_VALIDATION_VISIBLE", 30_000);
        expect(screen.text).toContain("GEMINI_VALIDATION_VISIBLE");
    });
});
