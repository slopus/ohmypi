import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionSkill } from "@/core/SessionSkill.js";
import { createCodexSkillsPrompt } from "@/vendors/codex/impl/createCodexSkillsPrompt.js";

export function withCodexSkills(
    context: SessionContext,
    skills: readonly SessionSkill[],
    model: string,
): SessionContext {
    const prompt = createCodexSkillsPrompt(skills, model);
    if (prompt === undefined) return context;
    const messages = context.messages.map((message) =>
        message.role === "system"
            ? {
                  ...message,
                  content:
                      typeof message.content === "string"
                          ? [message.content]
                          : [...message.content],
              }
            : message,
    );
    const target = messages.find(
        (message) =>
            message.role === "system" &&
            message.content.some((part) => part.startsWith("<apps_instructions>")),
    );
    if (target === undefined) messages.unshift({ role: "system", content: [prompt] });
    else if (target.role === "system") target.content.push(prompt);
    return { ...context, messages };
}
