import { SITE_LABELS } from '../lib/constants.js';
import { formatTokens, formatPercent } from '../lib/format.js';
import { usageEventIdentity, isTrackingEnabled, buildSnapshot, getState, updateState, savePreferences, saveSession, recordUsageEvent, exportState, importState, clearLocalHistory } from '../storage/store.js';
import { assertInternalExtensionSender, syncCloudState, getCloudStatus, connectCloudSession, disconnectCloudSession, recordCloudSyncFailure } from '../cloud/cloudSync.js';
import { getAdapterForUrl } from '../adapters/index.js';
import { sessionManager } from './sessionManager.js';

export var ALARM_NAME = "yor-token-usage-refresh";
const MAX_LIVE_DRAFT_CHARS = 250_000;

function getContentSenderContext(sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  const senderUrl = sender.tab?.url ?? sender.url;
  if (!Number.isSafeInteger(tabId) || (tabId as number) < 0 || !senderUrl) return null;

  try {
    const adapter = getAdapterForUrl(new URL(senderUrl));
    if (!adapter) return null;
    return { tabId: tabId as number, site: adapter.site };
  } catch {
    return null;
  }
}

export async function ensureState() {
    // @ts-ignore
  return updateState(async (state: any) => state);
}
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export async function withNotificationBudget(key: any, ttlMs: any, task: any) {
  let reserved = false;
    // @ts-ignore
  await updateState(async (state: any) => {
    const now = Date.now();
    const lastSent = state.meta.notificationTimestamps[key] ?? 0;
    if (now - lastSent < ttlMs) return state;
    reserved = true;
    return {
      ...state,
      meta: {
        ...state.meta,
        notificationTimestamps: {
          ...state.meta.notificationTimestamps,
          [key]: now
        }
      }
    };
  });
  if (reserved) {
    await task();
  }
}
export async function hasNotificationPermission() {
  if (!chrome.notifications?.create) return false;
  if (!chrome.permissions?.contains) return true;
  return chrome.permissions.contains({ permissions: ["notifications"] }).catch(() => false);
}
    // @ts-ignore
    // @ts-ignore
export async function notify(title: any, message: any) {
  if (!await hasNotificationPermission()) {
    return {
      ok: false,
      error: "Notification permission is not available. Re-enable notifications for the extension in your browser settings."
    };
  }
  const id = await chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/icons/icon-128.png",
    title,
    message
  });
  return { ok: true, id };
}
    // @ts-ignore
export async function updateBadge(session: any) {
  const state = await getState();
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
  const target = session && isTrackingEnabled(state.preferences, session.site) ? session : Object.values(state.sessions).filter((entry) => entry && isTrackingEnabled(state.preferences, entry.site)).sort((a, b) => (b?.lastUpdated ?? 0) - (a?.lastUpdated ?? 0))[0];
    // @ts-ignore
  if (!target || state.preferences.alerts.badgeMode === "off") {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
    // @ts-ignore
  const badgeText = state.preferences.alerts.badgeMode === "remaining" ? formatTokens(target.quota.remainingTokens).replace(/\.0K$/, "K") : formatPercent(target.quota.percentUsed).replace("%", "");
  await chrome.action.setBadgeText({ text: badgeText === "\u2014" ? "" : badgeText.slice(0, 4) });
  await chrome.action.setBadgeBackgroundColor({
    color: target.quota.status === "limited" ? "#ff5f6d" : target.quota.status === "warning" ? "#ffb84d" : "#6d8dff"
  });
}
    // @ts-ignore
export async function notifyIfNeededFromSession(session: any) {
    // @ts-ignore
  const preferences = (await getState()).preferences;
  if (!preferences.alerts.desktopNotifications) return;
  const threshold = preferences.alerts.quotaWarningPercent;
  if (session.quota.percentUsed !== void 0 && session.quota.percentUsed >= threshold) {
    await withNotificationBudget(`quota:${session.site}:${session.model}`, 45 * 6e4, async () => {
      await notify(
    // @ts-ignore
        `${SITE_LABELS[session.site]} quota warning`,
        `${session.model} is at ${formatPercent(session.quota.percentUsed)}. Reset ${session.quota.nextReset?.localLabel ?? "unknown"}.`
      );
    });
  }
}
    // @ts-ignore
export async function notifyIfNeededFromEvent(event: any) {
  const state = await getState();
    // @ts-ignore
  if (!state.preferences.alerts.desktopNotifications) return;
    // @ts-ignore
  if (event.totalTokens >= state.preferences.alerts.largePromptTokens) {
    await withNotificationBudget(`event:${event.id ?? usageEventIdentity(event)}`, 12 * 6e4, async () => {
      await notify("Large prompt detected", `That exchange used about ${formatTokens(event.totalTokens)} tokens.`);
    });
  }
  if (event.status === "rate_limited") {
    await withNotificationBudget(`limit:${event.site}:${event.resetAt ?? "unknown"}`, 30 * 6e4, async () => {
      await notify(
    // @ts-ignore
        `${SITE_LABELS[event.site]} limit reached`,
        event.rateLimitMessage ?? `The site signaled a usage limit. Reset ${event.resetAt ? "around " + new Date(event.resetAt).toLocaleTimeString() : "time is not known yet"}.`
      );
    });
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  sessionManager.removeTab(tabId);
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureState();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
    // @ts-ignore
  await updateBadge();
});
chrome.runtime.onStartup.addListener(async () => {
  await ensureState();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
    // @ts-ignore
  await updateBadge();
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const state = await getState();
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
  const sessions = Object.values(state.sessions).filter((session) => session && isTrackingEnabled(state.preferences, session.site));
  for (const session of sessions) {
    await notifyIfNeededFromSession(session);
  }
    // @ts-ignore
  await updateBadge();
  await syncCloudState().catch(recordCloudSyncFailure);
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-dashboard") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    return;
  }
  if (command === "toggle-overlay") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "toggle-overlay" }).catch(() => void 0);
    }
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      switch (message?.type) {
        case "submit-tab-observation": {
          const context = getContentSenderContext(sender);
          if (!context || context.site !== message.site) {
            sendResponse({ ok: false, error: "Observation sender does not match a supported provider tab" });
            break;
          }
          if (typeof message.draftText !== "string" || message.draftText.length > MAX_LIVE_DRAFT_CHARS) {
            sendResponse({ ok: false, error: "Draft is invalid or exceeds the live capture limit" });
            break;
          }

          sessionManager.setSession({
            tabId: context.tabId,
            site: context.site,
            threadId: typeof message.threadId === "string" ? message.threadId.slice(0, 512) : "",
            model: typeof message.model === "string" ? message.model.slice(0, 256) : "unknown",
            currentDraft: message.draftText,
            draftAnalysis: message.draftAnalysis,
            contextAccounting: message.contextAccounting,
            quotaSignal: message.quotaSignal ?? null,
            lastUpdated: Date.now()
          });
          sendResponse({ ok: true });
          break;
        }
        case "get-tab-view-state": {
          const context = getContentSenderContext(sender);
          if (!context || context.site !== message.site) {
            sendResponse({ ok: false, error: "Tab view sender does not match a supported provider tab" });
            break;
          }

          const state = await getState();
          const sitePreference = state.preferences.sites[context.site];
          const session = sessionManager.getSession(context.tabId, context.site);
          sendResponse({
            ok: true,
            siteEnabled: sitePreference.enabled,
            preferences: {
              showOverlay: state.preferences.showOverlay,
              theme: state.preferences.theme,
              anchorPosition: state.preferences.anchorPosition
            },
            sitePreference,
            session: session && (!message.threadId || session.threadId === message.threadId) ? session : undefined
          });
          break;
        }
        case "capture-session": {
          assertInternalExtensionSender(sender);
          const { state, session } = await saveSession(message.payload ?? message.session);
          await updateBadge(session);
          if (session) {
            await notifyIfNeededFromSession(session);
          }
    // @ts-ignore
          sendResponse({ ok: true, snapshot: buildSnapshot(state) });
          break;
        }
        case "commit-usage-event": {
          const usageEvent = message.payload ?? message.event;
          if (sender.tab) {
            const context = getContentSenderContext(sender);
            if (!context || context.site !== usageEvent?.site) {
              sendResponse({ ok: false, error: "Usage event sender does not match a supported provider tab" });
              break;
            }
          } else {
            assertInternalExtensionSender(sender);
          }
          const { recorded, event } = await recordUsageEvent(usageEvent);
    // @ts-ignore
          await updateBadge();
          if (recorded && event) {
            await notifyIfNeededFromEvent(event);
            void syncCloudState().catch(recordCloudSyncFailure);
          }
    // @ts-ignore
    // @ts-ignore
          sendResponse({ ok: true, eventId: event?.id, recorded });
          break;
        }
        case "get-snapshot": {
          assertInternalExtensionSender(sender);
          const state = await getState();
          sendResponse(buildSnapshot(state, message.activeUrl));
          break;
        }
        case "get-state": {
          assertInternalExtensionSender(sender);
          sendResponse(await getState());
          break;
        }
        case "save-preferences": {
          assertInternalExtensionSender(sender);
          const state = await savePreferences(message.payload);
    // @ts-ignore
          await updateBadge();
    // @ts-ignore
          sendResponse(buildSnapshot(state));
          break;
        }
        case "export-data": {
          assertInternalExtensionSender(sender);
          sendResponse(await exportState());
          break;
        }
        case "import-data": {
          assertInternalExtensionSender(sender);
          const state = await importState(message.payload);
    // @ts-ignore
          await updateBadge();
    // @ts-ignore
          sendResponse(buildSnapshot(state));
          break;
        }
        case "clear-local-history": {
          assertInternalExtensionSender(sender);
          const state = await clearLocalHistory();
    // @ts-ignore
          await updateBadge();
    // @ts-ignore
          sendResponse(buildSnapshot(state));
          break;
        }
        case "toggle-overlay": {
          assertInternalExtensionSender(sender);
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            const result = await chrome.tabs.sendMessage(tab.id, { type: "toggle-overlay", value: message.value }).catch(() => void 0);
            sendResponse(result ?? { ok: false });
          } else {
            sendResponse({ ok: false });
          }
          break;
        }
        case "notify": {
          assertInternalExtensionSender(sender);
          sendResponse(await notify(message.title, message.message));
          break;
        }
        case "cloud-status": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await getCloudStatus() });
          break;
        }
        case "cloud-connect": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await connectCloudSession(message.payload?.apiBaseUrl, message.payload?.accessToken) });
          break;
        }
        case "cloud-sync": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await syncCloudState() });
          break;
        }
        case "cloud-disconnect": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await disconnectCloudSession() });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();
  return true;
});

export {};
