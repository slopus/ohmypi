export function formatResetDuration(milliseconds: number): string {
    if (milliseconds <= 0) return "now";
    const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const remainingMinutes = minutes % 60;
    if (days > 0) return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
    if (hours === 0) return `${remainingMinutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
}
