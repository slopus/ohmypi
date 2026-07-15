export interface StartupStatusCardUsage {
    percentLeft: number;
    resetsIn: string;
}

export interface StartupStatusCardModel {
    access: string;
    environment: string;
    fast: boolean;
    model: string;
    provider: string;
    reasoning: string;
    session: "New session" | "Resumed";
    usage?: StartupStatusCardUsage;
    version: string;
    workspace: string;
}
