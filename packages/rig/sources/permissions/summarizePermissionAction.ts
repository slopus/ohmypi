export function summarizePermissionAction(toolName: string, args: unknown): string {
    if (args !== null && typeof args === "object") {
        const record = args as Record<string, unknown>;
        const command = readString(record, "cmd") ?? readString(record, "command");
        if (command !== undefined) return `running “${truncate(command)}”`;
        const url = readString(record, "url");
        if (url !== undefined) return `accessing ${truncate(url)}`;
        const path = readString(record, "file_path") ?? readString(record, "path");
        if (path !== undefined) return `using ${truncate(path)}`;
    }
    return `the ${humanize(toolName)} action`;
}

function humanize(value: string): string {
    return value
        .replaceAll("_", " ")
        .replace(/([a-z])([A-Z])/gu, "$1 $2")
        .toLowerCase();
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function truncate(value: string): string {
    const singleLine = value.replace(/\s+/gu, " ").trim();
    return singleLine.length <= 120 ? singleLine : `${singleLine.slice(0, 117)}…`;
}
