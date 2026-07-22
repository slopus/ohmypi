const MAX_SANITIZED_LENGTH = 200;

function djb2Hash(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return hash;
}

export function sanitizeClaudeProjectPath(path: string): string {
    const sanitized = path.replaceAll(/[^a-zA-Z0-9]/gu, "-");
    if (sanitized.length <= MAX_SANITIZED_LENGTH) return sanitized;
    return `${sanitized.slice(0, MAX_SANITIZED_LENGTH)}-${Math.abs(djb2Hash(path)).toString(36)}`;
}
