import { Type } from "@sinclair/typebox";

export const goalStatusSchema = Type.Union([
    Type.Literal("active"),
    Type.Literal("paused"),
    Type.Literal("blocked"),
    Type.Literal("complete"),
]);

export const sessionGoalSchema = Type.Object(
    {
        createdAt: Type.Number(),
        objective: Type.String(),
        status: goalStatusSchema,
        updatedAt: Type.Number(),
    },
    { additionalProperties: false },
);
