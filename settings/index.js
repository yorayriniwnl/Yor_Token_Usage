// src/lib/constants.ts
var SITE_LABELS = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  generic: "Other"
};
function makeResetRule(kind, description, intervalMinutes) {
  return {
    kind,
    intervalMinutes,
    inferred: true,
    description
  };
}
function makeSiteSettings(site) {
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
  return structuredClone(defaults[site]);
}
var DEFAULT_PREFERENCES = {
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

// src/lib/runtime.ts
async function sendRuntimeMessage(message) {
  return chrome.runtime.sendMessage(message);
}

// src/settings/index.ts
var saveState = document.querySelector("#save-state");
var siteSettings = document.querySelector("#site-settings");
var siteOrder = ["chatgpt", "claude", "gemini", "perplexity", "grok"];
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}
function setStatus(message) {
  saveState.textContent = message;
}
async function runButtonAction(button, task, doneLabel = "Done") {
  const originalLabel = button.textContent;
  button.classList.add("is-busy");
  try {
    await task();
    button.classList.remove("is-busy");
    button.classList.add("is-confirmed");
    button.textContent = doneLabel;
  } catch (error) {
    button.classList.remove("is-busy");
    button.textContent = "Failed";
    throw error;
  } finally {
    setTimeout(() => {
      button.classList.remove("is-confirmed", "is-busy");
      button.textContent = originalLabel;
    }, 900);
  }
}
function fillSelect(element, options, value) {
  element.innerHTML = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  element.value = value;
}
function inputValue(value) {
  return escapeHtml(value ?? "");
}
function renderSiteCard(site, preferences) {
  const settings = preferences.sites?.[site] ?? DEFAULT_PREFERENCES.sites[site];
  const resetRule = settings.resetRule ?? DEFAULT_PREFERENCES.sites[site].resetRule;
  const resetKind = resetRule.kind;
  return `
    <article class="site-card" data-site="${escapeHtml(site)}">
      <div>
        <h3>${escapeHtml(SITE_LABELS[site] ?? site)}</h3>
        <p>${escapeHtml(resetRule.description ?? "Configure how Yor should estimate this site.")}</p>
      </div>
      <label class="field inline"><input data-key="enabled" type="checkbox" ${settings.enabled ? "checked" : ""}/> <span>Enable tracking</span></label>
      <label class="field"><span>Reset rule</span>
        <select data-key="resetKind">
          ${["rolling", "hourly", "daily", "weekly", "custom", "unknown"].map((value) => `<option value="${escapeHtml(value)}" ${resetKind === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
        </select>
      </label>
      <label class="field"><span>Interval minutes</span><input data-key="intervalMinutes" type="number" min="1" value="${inputValue(resetRule.intervalMinutes)}" /></label>
      <label class="field"><span>Anchor time (UTC)</span><input data-key="anchorLocalTime" type="time" value="${inputValue(resetRule.anchorLocalTime ?? "00:00")}" /></label>
      <label class="field"><span>Day of week (0-6)</span><input data-key="dayOfWeek" type="number" min="0" max="6" value="${inputValue(resetRule.dayOfWeek ?? 1)}" /></label>
      <label class="field"><span>Window token budget</span><input data-key="tokenBudget" type="number" min="0" step="100" value="${inputValue(settings.tokenBudget)}" /></label>
      <label class="field"><span>Context window</span><input data-key="contextWindow" type="number" min="0" step="1000" value="${inputValue(settings.contextWindow)}" /></label>
      <label class="field"><span>Quota tier label</span><input data-key="quotaTierLabel" type="text" value="${inputValue(settings.quotaTierLabel)}" /></label>
      <label class="field"><span>Input cost / 1K</span><input data-key="costInputPer1k" type="number" min="0" step="0.0001" value="${inputValue(settings.costInputPer1k)}" /></label>
      <label class="field"><span>Output cost / 1K</span><input data-key="costOutputPer1k" type="number" min="0" step="0.0001" value="${inputValue(settings.costOutputPer1k)}" /></label>
    </article>
  `;
}
function readNumber(value) {
  if (!value.trim()) return void 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : void 0;
}
function collectPreferences(snapshot) {
  const next = structuredClone(snapshot.state.preferences);
  next.sites ??= structuredClone(DEFAULT_PREFERENCES.sites);
  next.theme = document.querySelector("#theme").value;
  next.privacyMode = document.querySelector("#privacy-mode").value;
  next.alerts.badgeMode = document.querySelector("#badge-mode").value;
  next.showOverlay = document.querySelector("#show-overlay").checked;
  next.compactMode = document.querySelector("#compact-mode").checked;
  next.alerts.desktopNotifications = document.querySelector("#desktop-notifications").checked;
  next.alerts.quotaWarningPercent = Number(document.querySelector("#quota-warning-percent").value);
  next.alerts.largePromptTokens = Number(document.querySelector("#large-prompt-tokens").value);
  next.alerts.anomalyMultiplier = Number(document.querySelector("#anomaly-multiplier").value);
  for (const site of siteOrder) {
    const card = document.querySelector(`.site-card[data-site="${site}"]`);
    const resetKind = card.querySelector('[data-key="resetKind"]').value;
    const currentSiteSettings = next.sites[site] ?? DEFAULT_PREFERENCES.sites[site];
    next.sites[site] = {
      ...currentSiteSettings,
      enabled: card.querySelector('[data-key="enabled"]').checked,
      resetRule: {
        kind: resetKind,
        intervalMinutes: readNumber(card.querySelector('[data-key="intervalMinutes"]').value),
        anchorLocalTime: card.querySelector('[data-key="anchorLocalTime"]').value,
        dayOfWeek: readNumber(card.querySelector('[data-key="dayOfWeek"]').value),
        inferred: true,
        description: currentSiteSettings.resetRule?.description
      },
      tokenBudget: readNumber(card.querySelector('[data-key="tokenBudget"]').value),
      contextWindow: readNumber(card.querySelector('[data-key="contextWindow"]').value),
      quotaTierLabel: card.querySelector('[data-key="quotaTierLabel"]').value,
      costInputPer1k: readNumber(card.querySelector('[data-key="costInputPer1k"]').value),
      costOutputPer1k: readNumber(card.querySelector('[data-key="costOutputPer1k"]').value)
    };
  }
  return next;
}
async function render() {
  let snapshot;
  try {
    snapshot = await sendRuntimeMessage({ type: "get-snapshot" });
  } catch (error) {
    setStatus(`Could not load settings: ${error instanceof Error ? error.message : String(error)}`);
    siteSettings.innerHTML = '<div class="empty-state">Settings could not be loaded. Reopen the options page and try again.</div>';
    return;
  }
  if (!snapshot?.state?.preferences) {
    setStatus("Could not load settings: snapshot data was incomplete.");
    siteSettings.innerHTML = '<div class="empty-state">Settings data was incomplete.</div>';
    return;
  }
  const preferences = snapshot.state.preferences;
  fillSelect(document.querySelector("#theme"), [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" }
  ], preferences.theme);
  fillSelect(document.querySelector("#privacy-mode"), [
    { value: "local-only", label: "Local only" },
    { value: "sync-preferences", label: "Sync preferences" }
  ], preferences.privacyMode);
  fillSelect(document.querySelector("#badge-mode"), [
    { value: "percent", label: "Percent used" },
    { value: "remaining", label: "Remaining tokens" },
    { value: "off", label: "Off" }
  ], preferences.alerts.badgeMode);
  document.querySelector("#show-overlay").checked = preferences.showOverlay;
  document.querySelector("#compact-mode").checked = preferences.compactMode;
  document.querySelector("#desktop-notifications").checked = preferences.alerts.desktopNotifications;
  document.querySelector("#quota-warning-percent").value = String(preferences.alerts.quotaWarningPercent);
  document.querySelector("#large-prompt-tokens").value = String(preferences.alerts.largePromptTokens);
  document.querySelector("#anomaly-multiplier").value = String(preferences.alerts.anomalyMultiplier);
  siteSettings.innerHTML = siteOrder.map((site) => renderSiteCard(site, preferences)).join("");
  document.querySelector("#save-btn").onclick = async (event) => {
    try {
      await runButtonAction(event.currentTarget, async () => {
        const payload = collectPreferences(snapshot);
        snapshot = await sendRuntimeMessage({ type: "save-preferences", payload });
      }, "Saved");
      setStatus("Saved settings. New assumptions will be used on the next session refresh.");
    } catch (error) {
      setStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  document.querySelector("#test-notification-btn").onclick = async (event) => {
    try {
      await runButtonAction(event.currentTarget, async () => {
        await sendRuntimeMessage({ type: "notify", title: "Yor Token Usage", message: "Notifications are enabled and working." });
      }, "Sent");
      setStatus("Test notification sent.");
    } catch (error) {
      setStatus(`Notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  document.querySelector("#export-btn").onclick = async (event) => {
    try {
      await runButtonAction(event.currentTarget, async () => {
        const payload = await sendRuntimeMessage({ type: "export-data" });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "yor-token-usage-export.json";
        anchor.click();
        URL.revokeObjectURL(url);
      }, "Exported");
      setStatus("Exported data to JSON.");
    } catch (error) {
      setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  document.querySelector("#import-input").onchange = async (event) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = JSON.parse(text);
      snapshot = await sendRuntimeMessage({ type: "import-data", payload: parsed });
      setStatus("Imported data. Refreshing the settings view.");
      await render();
    } catch (error) {
      setStatus(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  document.querySelector("#restore-defaults-btn").onclick = async (event) => {
    try {
      await runButtonAction(event.currentTarget, async () => {
        snapshot = await sendRuntimeMessage({ type: "save-preferences", payload: DEFAULT_PREFERENCES });
      }, "Restored");
      setStatus("Restored default settings.");
      await render();
    } catch (error) {
      setStatus(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}
void render();
