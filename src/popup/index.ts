export {};

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

async function getActiveTabUrl(): Promise<string | undefined> {
  if (typeof chrome !== "undefined" && chrome.tabs?.query) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url;
  }
  return undefined;
}

async function loadSnapshot() {
  const activeUrl = await getActiveTabUrl();
  return new Promise<any>((resolve) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "get-snapshot", activeUrl }, (response) => {
        resolve(response);
      });
    } else {
      resolve(null);
    }
  });
}

async function render() {
  const data = await loadSnapshot();
  if (!data) return;

  const usageCard = document.getElementById("usage-card");
  if (usageCard) {
    const session = data.currentSession;
    const tokensToday = data.summary?.tokensToday ?? 0;
    const promptsToday = data.summary?.promptsToday ?? 0;
    const draftTokens = session?.draftAnalysis?.inputTokens ?? 0;
    const model = session?.model || "No active session";
    const quota = session?.quotaSignal;
    const quotaPercent = quota?.percentUsed !== undefined ? `${quota.percentUsed}%` : "Unknown";

    usageCard.innerHTML = `
      <div class="card-metric">
        <span class="label">Today's Tokens</span>
        <strong class="value">${formatNumber(tokensToday)}</strong>
        <span class="subtext">${promptsToday} turn${promptsToday === 1 ? "" : "s"} completed</span>
      </div>
      <div class="card-meta">
        <div><span>Active Model:</span> <strong>${model}</strong></div>
        <div><span>Composer Draft:</span> <strong>${draftTokens} tokens</strong></div>
        <div><span>Observed Quota:</span> <strong>${quotaPercent}</strong></div>
      </div>
    `;
  }

  const modelBreakdown = document.getElementById("model-breakdown");
  if (modelBreakdown) {
    const events = data.state?.usageEvents || [];
    const modelCounts: Record<string, number> = {};
    for (const e of events) {
      modelCounts[e.model] = (modelCounts[e.model] || 0) + e.totalTokens;
    }
    const sorted = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

    if (sorted.length === 0) {
      modelBreakdown.innerHTML = `<p class="muted">No usage recorded yet.</p>`;
    } else {
      modelBreakdown.innerHTML = sorted
        .map(
          ([model, tokens]) => `
          <div class="split-row">
            <span>${model}</span>
            <strong>${formatNumber(tokens)}</strong>
          </div>
        `
        )
        .join("");
    }
  }

  const changeSummary = document.getElementById("change-summary");
  if (changeSummary) {
    const cost = data.summary?.costThisWeek ?? 0;
    changeSummary.textContent = `Estimated API-equivalent cost this week: $${cost.toFixed(4)}. No raw prompts or responses are sent to the cloud.`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void render();

  document.getElementById("refresh-btn")?.addEventListener("click", () => void render());
  document.getElementById("settings-btn")?.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
  document.getElementById("dashboard-btn")?.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    }
  });
  document.getElementById("toggle-overlay-btn")?.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "toggle-overlay" }, () => void render());
    }
  });
});
