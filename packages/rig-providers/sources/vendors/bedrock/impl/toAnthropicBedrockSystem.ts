import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionSkill } from "@/core/SessionSkill.js";

export function toAnthropicBedrockSystem(options: {
    context: SessionContext;
    skills: readonly SessionSkill[];
}): BetaTextBlockParam[] {
    const systemMessages = options.context.messages
        .filter((message) => message.role === "system")
        .flatMap((message) => message.content)
        .join("\n\n");
    const skillPrompt =
        options.skills.length === 0
            ? ""
            : `<skills>\n${options.skills
                  .map(
                      (skill) =>
                          `<skill name="${skill.name}" source="${skill.source}" location="${skill.location}">${skill.description}</skill>`,
                  )
                  .join("\n")}\n</skills>`;
    const text = [options.context.instructions, systemMessages, skillPrompt]
        .filter(Boolean)
        .join("\n\n");
    if (text.length === 0) return [];
    return [
        {
            type: "text",
            text,
            cache_control: { type: "ephemeral" },
        },
    ];
}
