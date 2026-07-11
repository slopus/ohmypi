import type { PermissionMode } from "./protocol";

export const permissionModeOptions: readonly {
    description: string;
    label: string;
    value: PermissionMode;
}[] = [
    {
        description: "Routine work proceeds automatically; risky actions ask for approval.",
        label: "Auto",
        value: "auto",
    },
    {
        description: "Writes stay in the working directory. Shell network access is blocked.",
        label: "Workspace write",
        value: "workspace_write",
    },
    {
        description: "Project files stay read only. Shell commands may write temporary files.",
        label: "Read only",
        value: "read_only",
    },
    {
        description: "Filesystem, shell, and network access are unrestricted.",
        label: "Full access",
        value: "full_access",
    },
];
