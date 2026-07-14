export type GlobalEventRouteName = "global-events" | "global-events-stream" | "global-events-trim";

export function isGlobalEventRoute(routeName: string): routeName is GlobalEventRouteName {
    return ["global-events", "global-events-stream", "global-events-trim"].includes(routeName);
}
