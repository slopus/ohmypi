import type { Message, ProviderImageProfile } from "../providers/types.js";
import { prepareProviderImageContent } from "./prepareProviderImageContent.js";

export async function prepareProviderMessageImages(
    messages: readonly Message[],
    profile: ProviderImageProfile = "codex",
): Promise<Message[]> {
    return Promise.all(
        messages.map(async (message) => {
            if (message.role === "assistant") {
                return message;
            }
            if (message.role === "user") {
                if (typeof message.content === "string") {
                    return message;
                }
                return {
                    ...message,
                    content: await Promise.all(
                        message.content.map((content) =>
                            prepareProviderImageContent(content, profile),
                        ),
                    ),
                };
            }
            return {
                ...message,
                content: await Promise.all(
                    message.content.map((content) => prepareProviderImageContent(content, profile)),
                ),
            };
        }),
    );
}
