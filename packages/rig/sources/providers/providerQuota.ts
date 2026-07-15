export type ProviderQuotaSource = "codex" | "claude-sdk";

export type ProviderQuotaWindow =
    | {
          capturedAt: number;
          status: "available";
          usedPercent: number;
          resetsAt: number;
          durationMs?: number;
      }
    | {
          status: "unavailable";
      };

export interface ProviderQuota {
    capturedAt: number;
    source: ProviderQuotaSource;
    windows: {
        fiveHour?: ProviderQuotaWindow;
        weekly?: ProviderQuotaWindow;
    };
}
