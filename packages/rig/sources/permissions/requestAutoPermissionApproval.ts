import type { UserInputContext } from "../agent/context/UserInputContext.js";

export async function requestAutoPermissionApproval(options: {
    action: string;
    reason: string;
    signal?: AbortSignal;
    toolCallId: string;
    userInput: UserInputContext | undefined;
}): Promise<boolean> {
    if (options.userInput === undefined) return false;
    const response = await options.userInput.request(
        {
            requestId: `${options.toolCallId}:permission`,
            questions: [
                {
                    header: "Permission",
                    id: "permission",
                    multiSelect: false,
                    options: [
                        {
                            label: "Allow once",
                            description: `Permit ${options.action} for this tool call only.`,
                        },
                        {
                            label: "Deny",
                            description: "Keep the current restrictions and reject this tool call.",
                        },
                    ],
                    question: `${options.reason} Allow ${options.action}?`,
                },
            ],
        },
        options.signal === undefined ? undefined : { signal: options.signal },
    );
    return response.answers.permission?.includes("Allow once") ?? false;
}
