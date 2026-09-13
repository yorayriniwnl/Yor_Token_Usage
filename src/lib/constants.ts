import { resolveModelProfile, calculateCost, normalizeModelKey, MODEL_CATALOG, MODEL_MATCHERS } from '../models/registry.js';
export { resolveModelProfile, calculateCost, normalizeModelKey, MODEL_CATALOG, MODEL_MATCHERS };
export var STATE_KEY = "yor-token-usage-state";
export var PREFERENCES_SYNC_KEY = "yor-token-usage-preferences";
export var CLOUD_CONFIG_KEY = "yor-token-usage-cloud-config";
export var CLOUD_SESSION_KEY = "yor-token-usage-cloud-session";
export var APP_VERSION = 1;
export var HISTORY_LIMIT = 2500;
export var CLOUD_MAX_BATCHES_PER_SYNC = 5;
export var CLOUD_EVENT_MAX_AGE_MS = 90 * 24 * 60 * 60_000;
export var SITE_LABELS = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  generic: "Other"
};
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export function modelLabelForDisplay(model: any) {
  return resolveModelProfile(model)?.label ?? model;
}
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export function makeResetRule(kind: any, description: any, intervalMinutes: any) {
  return {
    kind,
    intervalMinutes,
    inferred: true,
    description
  };
}
    // @ts-ignore
export function makeSiteSettings(site: any) {
  const defaults = {
    chatgpt: {
      enabled: true,
      resetRule: makeResetRule("rolling", "Inferred rolling window. Adjust in settings if your plan differs.", 180),
      quotaTierLabel: "Auto-detect"
    },
    claude: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    gemini: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    perplexity: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    grok: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    generic: {
      enabled: false,
      resetRule: {
        kind: "unknown",
        inferred: true,
        description: "Set a custom reset rule once you know the platform limits."
      },
      quotaTierLabel: "Custom"
    }
  };
    // @ts-ignore
  return structuredClone(defaults[site]);
}
export var DEFAULT_PREFERENCES = {
  theme: "system",
  compactMode: false,
  showOverlay: true,
  privacyMode: "local-only",
  alerts: {
    quotaWarningPercent: 85,
    largePromptTokens: 1800,
    anomalyMultiplier: 2.1,
    desktopNotifications: true,
    badgeMode: "percent"
  },
  sites: {
    chatgpt: makeSiteSettings("chatgpt"),
    claude: makeSiteSettings("claude"),
    gemini: makeSiteSettings("gemini"),
    perplexity: makeSiteSettings("perplexity"),
    grok: makeSiteSettings("grok"),
    generic: makeSiteSettings("generic")
  }
};

