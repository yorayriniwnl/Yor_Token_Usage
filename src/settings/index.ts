const SITE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  generic: "Generic"
};

const SITE_ORDER = ["chatgpt", "claude", "gemini", "perplexity", "grok", "generic"];

let currentPreferences: any = null;

async function sendMessage<T = any>(message: any): Promise<T> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(message, (response) => resolve(response));
    } else {
      resolve(null as any);
    }
  });
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSiteCard(site: string, sitePref: any): string {
  const resetRule = sitePref?.resetRule || { kind: "rolling", inferred: true };
  const resetKind = resetRule.kind || "rolling";
  const anchorLocalTime = resetRule.anchorLocalTime || "00:00";
  const dayOfWeek = resetRule.dayOfWeek ?? 1;

  return `
    <article class="site-card" data-site="${escapeHtml(site)}">
      <div>
        <h3>${escapeHtml(SITE_LABELS[site] || site)}</h3>
        <p>${escapeHtml(resetRule.description || "Configure how Yor should estimate this site.")}</p>
      </div>
      <label class="field inline"><input data-key="enabled" type="checkbox" ${sitePref?.enabled !== false ? "checked" : ""}/> <span>Enable tracking</span></label>
      <label class="field"><span>Reset rule</span>
        <select data-key="resetKind">
          ${["rolling", "hourly", "daily", "weekly", "custom", "unknown"].map((k) => `<option value="${k}" ${resetKind === k ? "selected" : ""}>${k}</option>`).join("")}
        </select>
      </label>
      <label class="field"><span>Interval minutes</span><input data-key="intervalMinutes" type="number" min="1" value="${resetRule.intervalMinutes ?? ""}" /></label>
      <label class="field"><span>Anchor time (UTC)</span><input data-key="anchorLocalTime" type="time" value="${anchorLocalTime}" /></label>
      <label class="field"><span>Day of week (0-6)</span><input data-key="dayOfWeek" type="number" min="0" max="6" value="${dayOfWeek}" /></label>
      <label class="field"><span>Window token budget</span><input data-key="tokenBudget" type="number" min="0" step="100" value="${sitePref?.tokenBudget ?? ""}" /></label>
      <label class="field"><span>Context window</span><input data-key="contextWindow" type="number" min="0" step="1000" value="${sitePref?.contextWindow ?? ""}" /></label>
      <label class="field"><span>Quota tier label</span><input data-key="quotaTierLabel" type="text" value="${escapeHtml(sitePref?.quotaTierLabel ?? "")}" /></label>
      <label class="field"><span>Input cost / 1K</span><input data-key="costInputPer1k" type="number" min="0" step="0.0001" value="${sitePref?.costInputPer1k ?? ""}" /></label>
      <label class="field"><span>Output cost / 1K</span><input data-key="costOutputPer1k" type="number" min="0" step="0.0001" value="${sitePref?.costOutputPer1k ?? ""}" /></label>
    </article>
  `;
}

async function loadSettings() {
  const snapshot = await sendMessage({ type: "get-snapshot" });
  const prefs = snapshot?.state?.preferences || {};
  currentPreferences = structuredClone(prefs);

  const themeSelect = document.getElementById("theme") as HTMLSelectElement | null;
  if (themeSelect) {
    themeSelect.innerHTML = `
      <option value="system">System default</option>
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    `;
    themeSelect.value = prefs.theme || "system";
  }

  const privacySelect = document.getElementById("privacy-mode") as HTMLSelectElement | null;
  if (privacySelect) {
    privacySelect.innerHTML = `
      <option value="local-only">Device only (Private)</option>
      <option value="sync-preferences">Chrome Sync (Preferences only)</option>
    `;
    privacySelect.value = prefs.privacyMode || "local-only";
  }

  const badgeSelect = document.getElementById("badge-mode") as HTMLSelectElement | null;
  if (badgeSelect) {
    badgeSelect.innerHTML = `
      <option value="percent">Percentage</option>
      <option value="remaining">Remaining tokens</option>
      <option value="off">Off</option>
    `;
    badgeSelect.value = prefs.alerts?.badgeMode || "percent";
  }

  const showOverlay = document.getElementById("show-overlay") as HTMLInputElement | null;
  if (showOverlay) showOverlay.checked = prefs.showOverlay !== false;

  const compactMode = document.getElementById("compact-mode") as HTMLInputElement | null;
  if (compactMode) compactMode.checked = prefs.compactMode === true;

  const desktopNotifications = document.getElementById("desktop-notifications") as HTMLInputElement | null;
  if (desktopNotifications) desktopNotifications.checked = prefs.alerts?.desktopNotifications !== false;

  const quotaWarning = document.getElementById("quota-warning-percent") as HTMLInputElement | null;
  if (quotaWarning) quotaWarning.value = String(prefs.alerts?.quotaWarningPercent ?? 80);

  const largePrompt = document.getElementById("large-prompt-tokens") as HTMLInputElement | null;
  if (largePrompt) largePrompt.value = String(prefs.alerts?.largePromptTokens ?? 2500);

  const anomaly = document.getElementById("anomaly-multiplier") as HTMLInputElement | null;
  if (anomaly) anomaly.value = String(prefs.alerts?.anomalyMultiplier ?? 2.5);

  // Render site cards
  const siteContainer = document.getElementById("site-settings");
  if (siteContainer) {
    siteContainer.innerHTML = SITE_ORDER.map((site) => renderSiteCard(site, prefs.sites?.[site])).join("");
  }

  // Cloud status
  await updateCloudStatus();
}

async function updateCloudStatus() {
  const statusRes = await sendMessage({ type: "cloud-status" });
  const pill = document.getElementById("cloud-status-pill");
  const connectBtn = document.getElementById("cloud-connect-btn") as HTMLButtonElement | null;
  const syncBtn = document.getElementById("cloud-sync-btn") as HTMLButtonElement | null;
  const disconnectBtn = document.getElementById("cloud-disconnect-btn") as HTMLButtonElement | null;
  const apiUrlInput = document.getElementById("cloud-api-url") as HTMLInputElement | null;

  if (statusRes?.connected && statusRes.config) {
    if (pill) {
      pill.textContent = "Cloud Sync Active";
      pill.setAttribute("data-state", "connected");
    }
    if (connectBtn) connectBtn.disabled = true;
    if (syncBtn) syncBtn.disabled = false;
    if (disconnectBtn) disconnectBtn.disabled = false;
    if (apiUrlInput) apiUrlInput.value = statusRes.config.apiBaseUrl || "";
  } else {
    if (pill) {
      pill.textContent = "Local only";
      pill.setAttribute("data-state", "local");
    }
    if (connectBtn) connectBtn.disabled = false;
    if (syncBtn) syncBtn.disabled = true;
    if (disconnectBtn) disconnectBtn.disabled = true;
  }
}

async function saveCurrentSettings() {
  const theme = (document.getElementById("theme") as HTMLSelectElement)?.value as any;
  const privacyMode = (document.getElementById("privacy-mode") as HTMLSelectElement)?.value as any;
  const showOverlay = (document.getElementById("show-overlay") as HTMLInputElement)?.checked;
  const compactMode = (document.getElementById("compact-mode") as HTMLInputElement)?.checked;
  const desktopNotifications = (document.getElementById("desktop-notifications") as HTMLInputElement)?.checked;
  const quotaWarningPercent = Number((document.getElementById("quota-warning-percent") as HTMLInputElement)?.value) || 80;
  const largePromptTokens = Number((document.getElementById("large-prompt-tokens") as HTMLInputElement)?.value) || 2500;
  const anomalyMultiplier = Number((document.getElementById("anomaly-multiplier") as HTMLInputElement)?.value) || 2.5;
  const badgeMode = ((document.getElementById("badge-mode") as HTMLSelectElement)?.value as any) || "percent";

  const updatedSites: Record<string, any> = {};

  for (const site of SITE_ORDER) {
    const card = document.querySelector(`.site-card[data-site="${site}"]`);
    const initialSitePref = currentPreferences?.sites?.[site] || {};
    const initialRule = initialSitePref?.resetRule || { kind: "rolling", inferred: true };

    if (!card) {
      updatedSites[site] = initialSitePref;
      continue;
    }

    const enabled = (card.querySelector('[data-key="enabled"]') as HTMLInputElement)?.checked ?? true;
    const resetKind = (card.querySelector('[data-key="resetKind"]') as HTMLSelectElement)?.value || initialRule.kind;
    const anchorLocalTime = (card.querySelector('[data-key="anchorLocalTime"]') as HTMLInputElement)?.value || "00:00";
    const dayOfWeekVal = (card.querySelector('[data-key="dayOfWeek"]') as HTMLInputElement)?.value;
    const dayOfWeek = dayOfWeekVal !== "" && dayOfWeekVal !== undefined ? Number(dayOfWeekVal) : (initialRule.dayOfWeek ?? 1);
    const intervalMinutesVal = (card.querySelector('[data-key="intervalMinutes"]') as HTMLInputElement)?.value;
    const intervalMinutes = intervalMinutesVal ? Number(intervalMinutesVal) : initialRule.intervalMinutes;

    const displayedKind = initialRule.kind || "rolling";
    const displayedAnchor = initialRule.anchorLocalTime || "00:00";
    const displayedDay = initialRule.dayOfWeek ?? 1;
    const displayedInterval = initialRule.intervalMinutes;

    const resetChanged =
      resetKind !== displayedKind ||
      anchorLocalTime !== displayedAnchor ||
      dayOfWeek !== displayedDay ||
      intervalMinutes !== displayedInterval;

    const inferred = resetChanged ? false : initialRule.inferred !== false;

    updatedSites[site] = {
      ...initialSitePref,
      enabled,
      resetRule: {
        ...initialRule,
        kind: resetKind,
        anchorLocalTime,
        dayOfWeek,
        ...(intervalMinutes !== undefined ? { intervalMinutes } : {}),
        inferred,
        description: resetChanged
          ? "User-configured schedule estimate; not a verified provider reset."
          : initialRule.description
      }
    };
  }

  await sendMessage({
    type: "save-preferences",
    payload: {
      theme,
      privacyMode,
      showOverlay,
      compactMode,
      alerts: {
        quotaWarningPercent,
        largePromptTokens,
        anomalyMultiplier,
        desktopNotifications,
        badgeMode
      },
      sites: updatedSites
    }
  });

  currentPreferences = structuredClone({
    ...currentPreferences,
    theme,
    privacyMode,
    showOverlay,
    compactMode,
    alerts: {
      quotaWarningPercent,
      largePromptTokens,
      anomalyMultiplier,
      desktopNotifications,
      badgeMode
    },
    sites: updatedSites
  });

  const saveBtn = document.getElementById("save-btn");
  if (saveBtn) {
    const orig = saveBtn.textContent;
    saveBtn.textContent = "Saved!";
    setTimeout(() => {
      saveBtn.textContent = orig;
    }, 1500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void loadSettings();

  document.getElementById("save-btn")?.addEventListener("click", () => void saveCurrentSettings());

  document.getElementById("cloud-connect-btn")?.addEventListener("click", async () => {
    const apiUrl = (document.getElementById("cloud-api-url") as HTMLInputElement)?.value.trim();
    const token = (document.getElementById("cloud-access-token") as HTMLInputElement)?.value.trim();
    if (!apiUrl) {
      alert("Please enter a backend URL.");
      return;
    }
    const res = await sendMessage({
      type: "cloud-connect",
      payload: { apiBaseUrl: apiUrl, accessToken: token }
    });
    if (res?.ok) {
      await updateCloudStatus();
    } else {
      alert(`Connection failed: ${res?.error || "Unknown error"}`);
    }
  });

  document.getElementById("cloud-sync-btn")?.addEventListener("click", async () => {
    const res = await sendMessage({ type: "cloud-sync" });
    if (res?.ok) {
      alert("Sync completed successfully.");
      await updateCloudStatus();
    } else {
      alert(`Sync error: ${res?.error || "Failed"}`);
    }
  });

  document.getElementById("cloud-disconnect-btn")?.addEventListener("click", async () => {
    await sendMessage({ type: "cloud-disconnect" });
    await updateCloudStatus();
  });

  document.getElementById("clear-local-history-btn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all local token history? Preferences will be preserved.")) {
      await sendMessage({ type: "clear-local-history" });
      alert("Local history cleared.");
    }
  });
});

export {};
