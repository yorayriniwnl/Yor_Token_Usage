import type { ProviderId } from "./models.js";
import type { LiveTabSession, UsageEventRecord, UserPreferences } from "./state.js";
import type { DraftAnalysis, ThreadContextAccounting } from "./tokens.js";
import type { ObservedQuotaSignal } from "./adapters.js";

export type ContentToBackgroundMessage =
  | {
      type: "submit-tab-observation";
      site: ProviderId;
      threadId: string;
      model: string;
      draftText: string;
      draftAnalysis: DraftAnalysis;
      contextAccounting: ThreadContextAccounting;
      quotaSignal: ObservedQuotaSignal | null;
    }
  | {
      type: "commit-usage-event";
      event: Omit<UsageEventRecord, "id"> & { id?: string };
    }
  | {
      type: "get-tab-view-state";
      site: ProviderId;
      threadId?: string;
    }
  | {
      type: "toggle-overlay";
      value?: boolean;
    };

export type UItoBackgroundMessage =
  | {
      type: "get-snapshot";
      activeUrl?: string;
    }
  | {
      type: "get-state";
    }
  | {
      type: "save-preferences";
      payload: Partial<UserPreferences>;
    }
  | {
      type: "clear-local-history";
    }
  | {
      type: "export-data";
    }
  | {
      type: "import-data";
      payload: unknown;
    }
  | {
      type: "cloud-status";
    }
  | {
      type: "cloud-connect";
      payload: { apiBaseUrl: string; accessToken: string; deviceName?: string };
    }
  | {
      type: "cloud-disconnect";
    }
  | {
      type: "cloud-sync";
    };

export type ExtensionMessage = ContentToBackgroundMessage | UItoBackgroundMessage;

export interface TabViewStateResponse {
  ok: boolean;
  siteEnabled: boolean;
  preferences: Pick<UserPreferences, "showOverlay" | "theme" | "anchorPosition">;
  session?: LiveTabSession;
}
