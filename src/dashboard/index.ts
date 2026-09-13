export {};

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

async function loadSnapshot() {
  return new Promise<any>((resolve) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "get-snapshot" }, (response) => {
        resolve(response);
      });
    } else {
      resolve(null);
    }
  });
}

function renderMetricCard(label: string, value: string | number, subtext = ""): string {
  return `
    <div class="metric-card panel">
      <span class="eyebrow">${label}</span>
      <strong>${value}</strong>
      ${subtext ? `<span class="subtext">${subtext}</span>` : ""}
    </div>
  `;
}

async function render() {
  const data = await loadSnapshot();
  if (!data) return;

  const metricsEl = document.getElementById("metrics");
  if (metricsEl) {
    const summary = data.summary || {};
    metricsEl.innerHTML = [
      renderMetricCard("Prompts today", summary.promptsToday ?? 0),
      renderMetricCard("Tokens today", formatNumber(summary.tokensToday ?? 0)),
      renderMetricCard("Tokens this week", formatNumber(summary.tokensThisWeek ?? 0)),
      renderMetricCard("Estimated API cost", `$${(summary.costThisWeek ?? 0).toFixed(4)}`, "7-day proxy approximation")
    ].join("");
  }

  const siteBreakdown = document.getElementById("site-breakdown");
  if (siteBreakdown) {
    const events = data.state?.usageEvents || [];
    const siteTokens: Record<string, number> = {};
    for (const e of events) {
      siteTokens[e.site] = (siteTokens[e.site] || 0) + e.totalTokens;
    }
    const entries = Object.entries(siteTokens).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      siteBreakdown.innerHTML = `<p class="muted">No site activity captured yet.</p>`;
    } else {
      siteBreakdown.innerHTML = entries
        .map(
          ([site, tokens]) => `
          <div class="split-row">
            <span>${site.toUpperCase()}</span>
            <strong>${formatNumber(tokens)} tokens</strong>
          </div>
        `
        )
        .join("");
    }
  }

  const modelBreakdown = document.getElementById("model-breakdown");
  if (modelBreakdown) {
    const events = data.state?.usageEvents || [];
    const modelTokens: Record<string, number> = {};
    for (const e of events) {
      modelTokens[e.model] = (modelTokens[e.model] || 0) + e.totalTokens;
    }
    const entries = Object.entries(modelTokens).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      modelBreakdown.innerHTML = `<p class="muted">No model data available.</p>`;
    } else {
      modelBreakdown.innerHTML = entries
        .map(
          ([model, tokens]) => `
          <div class="split-row">
            <span>${model}</span>
            <strong>${formatNumber(tokens)} tokens</strong>
          </div>
        `
        )
        .join("");
    }
  }

  const recentThreads = document.getElementById("recent-threads");
  if (recentThreads) {
    const threads = data.recentThreads || [];
    if (threads.length === 0) {
      recentThreads.innerHTML = `<p class="muted">No threads captured yet.</p>`;
    } else {
      recentThreads.innerHTML = threads
        .map(
          (t: any) => `
          <div class="thread-item">
            <div><strong>${t.id}</strong> <span class="muted">(${t.model})</span></div>
            <div>${t.messageCount} messages • ${formatNumber(t.totalTokens)} tokens</div>
          </div>
        `
        )
        .join("");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void render();

  document.getElementById("settings-btn")?.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  document.getElementById("export-json-btn")?.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "export-data" }, (response) => {
        if (response) {
          const blob = new Blob([JSON.stringify(response, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `yor-token-usage-export-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    }
  });
});
