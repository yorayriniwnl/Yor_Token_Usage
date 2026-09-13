"use strict";
(() => {
  // src/shared/utils.ts
  function uid(prefix = "yor") {
    const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
    return `${prefix}_${randomPart}_${Date.now().toString(36)}`;
  }
  function debounce(fn, delay = 200) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
  function compactWhitespace(input) {
    return String(input ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  // src/adapters/base.ts
  function queryFirst(selectors, root = document) {
    for (const selector of selectors) {
      try {
        const element = root.querySelector(selector);
        if (element) return element;
      } catch {
        continue;
      }
    }
    return null;
  }
  function queryAll(selectors, root = document) {
    try {
      const combined = selectors.join(", ");
      return Array.from(root.querySelectorAll(combined));
    } catch {
      const elements = [];
      for (const selector of selectors) {
        try {
          root.querySelectorAll(selector).forEach((el) => {
            if (!elements.includes(el)) elements.push(el);
          });
        } catch {
          continue;
        }
      }
      return elements;
    }
  }
  function parseRelativeReset(text) {
    const durationMatch = text.match(/(?:\bin\b|\bafter\b)\s*:?[ \t]*(?:(\d+)\s*(?:hours?|hrs?|h)\b)?\s*(?:(\d+)\s*(?:minutes?|mins?|m)\b)?/i);
    if (durationMatch && (durationMatch[1] || durationMatch[2])) {
      const duration = Number(durationMatch[1] || 0) * 36e5 + Number(durationMatch[2] || 0) * 6e4;
      if (duration > 0) return Date.now() + duration;
    }
    const minutesMatch = text.match(/(?:in|after)\s+(\d+)\s+minutes?/i);
    if (minutesMatch) {
      return Date.now() + Number.parseInt(minutesMatch[1], 10) * 6e4;
    }
    const hoursMatch = text.match(/(?:in|after)\s+(\d+)\s+hours?/i);
    if (hoursMatch) {
      return Date.now() + Number.parseInt(hoursMatch[1], 10) * 36e5;
    }
    const clockMatch = text.match(/(?:until|at|after)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (clockMatch) {
      const parsed = /* @__PURE__ */ new Date(`${(/* @__PURE__ */ new Date()).toDateString()} ${clockMatch[1]}`);
      if (!Number.isNaN(parsed.getTime())) {
        if (parsed.getTime() < Date.now()) parsed.setDate(parsed.getDate() + 1);
        return parsed.getTime();
      }
    }
    const absoluteMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?(?:\s+at)?\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (absoluteMatch) {
      const parsed = new Date(absoluteMatch[1]);
      return Number.isNaN(parsed.getTime()) ? void 0 : parsed.getTime();
    }
    return void 0;
  }
  function parseQuotaHintsFromText(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return { source: "unknown" };
    const limited = /(?:reached|exceeded|hit)[^.]*\b(?:limit|quota)\b|too many requests|try again later|(?:limit|quota)\s+(?:reached|exceeded)/i.test(normalized);
    const remainingMatch = normalized.match(/(?<![\d.,])(\d+(?:,\d{3})*)\s+tokens\s+remaining/i);
    const percentMatch = normalized.match(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%\s*(used|remaining)/i);
    const percentage = percentMatch ? Number(percentMatch[1]) : void 0;
    const tierMatch = normalized.match(/\b(plus|pro|advanced|premium|free)\b/i);
    return {
      resetAt: /\bresets?\b|\btry again\b/i.test(normalized) ? parseRelativeReset(normalized) : void 0,
      rateLimitMessage: limited ? normalized.slice(0, 220) : void 0,
      remainingTokens: remainingMatch ? Number.parseInt(remainingMatch[1].replace(/,/g, ""), 10) : void 0,
      percentUsed: percentage !== void 0 && percentage <= 100 ? percentMatch[2].toLowerCase() === "remaining" ? 100 - percentage : percentage : void 0,
      quotaTier: tierMatch?.[1] ? tierMatch[1][0].toUpperCase() + tierMatch[1].slice(1).toLowerCase() : void 0,
      status: limited ? "limited" : void 0,
      source: "dom_alert",
      rawText: normalized.slice(0, 300)
    };
  }
  function normalizeMessageText(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('button, [role="toolbar"], time, [role="status"], [aria-hidden="true"], .sr-only').forEach((el) => el.remove());
    const heading = copy.querySelector('h1, h2, h3, [role="heading"]');
    if (heading && /^(You said:|Claude responded:)/i.test(heading.textContent?.trim() ?? "")) {
      heading.remove();
    }
    copy.querySelectorAll("p, div, li, pre, br").forEach((el) => el.append("\n"));
    return compactWhitespace(copy.textContent || "");
  }
  function determineSemanticRole(node) {
    const attributeNames = ["data-message-author-role", "data-is-author", "data-author", "data-testid", "aria-label", "class"];
    const parts = [];
    let cursor = node;
    for (let depth = 0; cursor && depth < 5; depth += 1) {
      for (const name of attributeNames) {
        const value = cursor.getAttribute?.(name);
        if (value) parts.push(value);
      }
      cursor = cursor.parentElement;
    }
    const haystack = parts.join(" ").toLowerCase();
    if (/\b(user|human|you)\b|font-user|human-message|user-message/.test(haystack)) return "user";
    if (/\b(assistant|model|ai|response|answer|claude)\b|font-claude|assistant-message|ai-message/.test(haystack)) return "assistant";
    if (node.matches?.(".prose, [class*='font-claude']")) return "assistant";
    return "unknown";
  }

  // src/adapters/chatgpt.ts
  var ChatGPTAdapter = class {
    site = "chatgpt";
    label = "ChatGPT";
    matches(url) {
      return url.hostname === "chatgpt.com" || url.hostname === "chat.openai.com" || url.hostname.endsWith(".chatgpt.com");
    }
    detectModel(root = document) {
      const selector = [
        '[data-testid="model-switcher-dropdown-button"]',
        'button[aria-haspopup="menu"][data-testid*="model"]',
        '[data-testid*="model-selector"]',
        'button:has([data-testid*="model"])'
      ];
      const el = queryFirst(selector, root);
      const rawName = el?.textContent?.trim() || void 0;
      return {
        rawName,
        label: rawName ? compactWhitespace(rawName) : void 0,
        isKnown: Boolean(rawName)
      };
    }
    findComposer(root = document) {
      return queryFirst(
        [
          "#prompt-textarea",
          '[data-testid="prompt-textarea"]',
          "form textarea",
          'div[contenteditable="true"][data-placeholder]',
          'textarea[placeholder*="Message"]'
        ],
        root
      );
    }
    readComposerText(composer) {
      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        return composer.value;
      }
      return composer.innerText || composer.textContent || "";
    }
    findSendControl(root = document) {
      return queryFirst(
        [
          '[data-testid="send-button"]',
          'button[aria-label="Send prompt"]',
          'button[aria-label="Send message"]',
          'form button[type="submit"]',
          'button[data-testid*="send"]'
        ],
        root
      );
    }
    findStopControl(root = document) {
      return queryFirst(
        [
          '[data-testid="stop-button"]',
          'button[aria-label="Stop generating"]',
          'button[aria-label="Stop response"]',
          'button[data-testid*="stop"]'
        ],
        root
      );
    }
    collectVisibleMessages(root = document) {
      const turns = queryAll(["[data-message-author-role]", 'article[data-testid*="conversation-turn"]', '[data-testid*="message"]'], root);
      const messages = [];
      turns.forEach((turn, index) => {
        const role = determineSemanticRole(turn);
        const text = normalizeMessageText(turn);
        if (text) {
          messages.push({
            id: turn.getAttribute("data-message-id") || `turn_${index}`,
            role,
            text,
            index,
            source: role === "unknown" ? "fallback" : "semantic"
          });
        }
      });
      return messages;
    }
    getConversationId(url, _root) {
      const parts = url.pathname.split("/").filter(Boolean);
      const cIndex = parts.indexOf("c");
      if (cIndex !== -1 && parts[cIndex + 1]) {
        return `chatgpt:${parts[cIndex + 1]}`;
      }
      if (parts.length > 0) {
        return `chatgpt:${parts[parts.length - 1]}`;
      }
      return "chatgpt:new";
    }
    getQuotaSignals(root = document) {
      const alert = queryFirst(
        [
          '[role="alert"]',
          ".alert-error",
          '[data-testid*="limit-banner"]',
          '[data-testid*="quota"]'
        ],
        root
      );
      if (!alert || !alert.textContent) return null;
      return parseQuotaHintsFromText(alert.textContent);
    }
    getAttachmentDescriptors(root = document) {
      const items = queryAll(['[data-testid*="attachment"]', '[data-testid*="file"]'], root);
      return items.map((item, idx) => ({
        name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
        tokenProvenance: "unknown"
      }));
    }
  };

  // src/adapters/claude.ts
  var ClaudeAdapter = class {
    site = "claude";
    label = "Claude";
    matches(url) {
      return url.hostname === "claude.ai" || url.hostname.endsWith(".claude.ai");
    }
    detectModel(root = document) {
      const el = queryFirst(
        [
          '[data-testid="model-selector"]',
          'button:has([data-testid="model-selector"])',
          'header button:has-text("Claude")',
          "header button"
        ],
        root
      );
      const rawName = el?.textContent?.trim() || void 0;
      return {
        rawName,
        label: rawName ? compactWhitespace(rawName) : void 0,
        isKnown: Boolean(rawName)
      };
    }
    findComposer(root = document) {
      return queryFirst(
        [
          '.ProseMirror[contenteditable="true"]',
          'div[contenteditable="true"][aria-label*="Message"]',
          'div[contenteditable="true"]',
          'textarea[placeholder*="Message"]'
        ],
        root
      );
    }
    readComposerText(composer) {
      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        return composer.value;
      }
      return composer.innerText || composer.textContent || "";
    }
    findSendControl(root = document) {
      return queryFirst(
        [
          'button[aria-label="Send"]',
          'button[aria-label="Send Message"]',
          'button[aria-label="Send message"]',
          'form button:has-text("Send")'
        ],
        root
      );
    }
    findStopControl(root = document) {
      return queryFirst(
        [
          'button[aria-label="Stop response"]',
          'button[aria-label="Stop generating"]',
          'button:has-text("Stop")'
        ],
        root
      );
    }
    collectVisibleMessages(root = document) {
      const turns = queryAll(
        [
          '[data-testid="user-message"]',
          '[data-testid="assistant-message"]',
          '[role="feed"] article',
          'article[aria-label*="Message"]',
          ".font-claude-message",
          ".font-user-message"
        ],
        root
      );
      const messages = [];
      const roleCounts = /* @__PURE__ */ new Map();
      turns.forEach((turn, index) => {
        let role = "unknown";
        const testId = turn.getAttribute("data-testid") || "";
        if (testId.includes("user")) role = "user";
        else if (testId.includes("assistant")) role = "assistant";
        else {
          const heading = turn.querySelector('h1, h2, h3, [role="heading"]')?.textContent?.trim() ?? "";
          if (/^You said:/i.test(heading)) role = "user";
          else if (/^Claude responded:/i.test(heading)) role = "assistant";
          else role = determineSemanticRole(turn);
        }
        const text = normalizeMessageText(turn);
        if (text) {
          const countKey = `${role}::${text}`;
          const count = roleCounts.get(countKey) || 0;
          roleCounts.set(countKey, count + 1);
          const id = turn.getAttribute("data-message-id") || turn.getAttribute("id") || `${role}:${count}:${text.slice(0, 120)}`;
          messages.push({
            id,
            role,
            text,
            index,
            source: role === "unknown" ? "fallback" : "semantic"
          });
        }
      });
      return messages;
    }
    getConversationId(url, _root) {
      const parts = url.pathname.split("/").filter(Boolean);
      const chatIndex = parts.indexOf("chat");
      if (chatIndex !== -1 && parts[chatIndex + 1]) {
        return `claude:${parts[chatIndex + 1]}`;
      }
      return parts.length > 0 ? `claude:${parts[parts.length - 1]}` : "claude:new";
    }
    getQuotaSignals(root = document) {
      const alerts = queryAll(['[role="alert"]', "footer", ".text-danger", '[data-testid*="quota"]'], root);
      for (const el of alerts) {
        const text = el.textContent?.trim();
        if (text && /(?:resets?|messages left|limit|try again)/i.test(text)) {
          return parseQuotaHintsFromText(text);
        }
      }
      return null;
    }
    getAttachmentDescriptors(root = document) {
      const items = queryAll(['[data-testid*="attachment"]', '[data-testid*="file-pill"]'], root);
      return items.map((item, idx) => ({
        name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
        tokenProvenance: "unknown"
      }));
    }
  };

  // src/adapters/gemini.ts
  var GeminiAdapter = class {
    site = "gemini";
    label = "Gemini";
    matches(url) {
      return url.hostname === "gemini.google.com" || url.hostname.endsWith(".gemini.google.com");
    }
    detectModel(root = document) {
      const el = queryFirst(
        [
          '[data-test-id="model-picker-btn"]',
          'button[aria-label*="model" i]',
          ".model-select-button"
        ],
        root
      );
      const rawName = el?.textContent?.trim() || void 0;
      return {
        rawName,
        label: rawName ? compactWhitespace(rawName) : void 0,
        isKnown: Boolean(rawName)
      };
    }
    findComposer(root = document) {
      return queryFirst(
        [
          '.ql-editor[contenteditable="true"]',
          'rich-textarea [contenteditable="true"]',
          'div[contenteditable="true"][aria-label*="prompt" i]',
          'textarea[aria-label*="prompt" i]'
        ],
        root
      );
    }
    readComposerText(composer) {
      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        return composer.value;
      }
      return composer.innerText || composer.textContent || "";
    }
    findSendControl(root = document) {
      return queryFirst(
        [
          'button[aria-label*="Send message" i]',
          "button.send-button",
          '[data-test-id="send-button"]'
        ],
        root
      );
    }
    findStopControl(root = document) {
      return queryFirst(
        [
          'button[aria-label*="Stop response" i]',
          'button[aria-label*="Stop generating" i]',
          ".stop-button"
        ],
        root
      );
    }
    collectVisibleMessages(root = document) {
      const turns = queryAll(
        [
          "user-query",
          "model-response",
          "[data-message-author-role]",
          ".conversation-container .message"
        ],
        root
      );
      const messages = [];
      turns.forEach((turn, index) => {
        let role = "unknown";
        const tagName = turn.tagName.toLowerCase();
        if (tagName === "user-query" || turn.classList.contains("user-query")) {
          role = "user";
        } else if (tagName === "model-response" || turn.classList.contains("model-response")) {
          role = "assistant";
        } else {
          role = determineSemanticRole(turn);
        }
        const text = normalizeMessageText(turn);
        if (text) {
          messages.push({
            id: turn.getAttribute("data-message-id") || `gemini_${index}`,
            role,
            text,
            index,
            source: role === "unknown" ? "fallback" : "semantic"
          });
        }
      });
      return messages;
    }
    getConversationId(url, _root) {
      const parts = url.pathname.split("/").filter(Boolean);
      const appIndex = parts.indexOf("app");
      if (appIndex !== -1 && parts[appIndex + 1]) {
        return `gemini:${parts[appIndex + 1]}`;
      }
      return parts.length > 0 ? `gemini:${parts[parts.length - 1]}` : "gemini:root";
    }
    getQuotaSignals(root = document) {
      const banner = queryFirst(['[role="alert"]', ".quota-banner", ".warning-message"], root);
      if (!banner || !banner.textContent) return null;
      return parseQuotaHintsFromText(banner.textContent);
    }
    getAttachmentDescriptors(root = document) {
      const items = queryAll(['[data-test-id*="attachment"]', ".file-preview"], root);
      return items.map((item, idx) => ({
        name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
        tokenProvenance: "unknown"
      }));
    }
  };

  // src/adapters/perplexity.ts
  var PerplexityAdapter = class {
    site = "perplexity";
    label = "Perplexity";
    matches(url) {
      return url.hostname === "perplexity.ai" || url.hostname.endsWith(".perplexity.ai");
    }
    detectModel(root = document) {
      const el = queryFirst(
        [
          'button[aria-label*="model" i]',
          '[data-testid*="model"]',
          ".model-badge"
        ],
        root
      );
      const rawName = el?.textContent?.trim() || void 0;
      return {
        rawName,
        label: rawName ? compactWhitespace(rawName) : void 0,
        isKnown: Boolean(rawName)
      };
    }
    findComposer(root = document) {
      return queryFirst(
        [
          'textarea[placeholder*="Ask anything" i]',
          'textarea[placeholder*="Ask follow-up" i]',
          "textarea",
          'div[contenteditable="true"]'
        ],
        root
      );
    }
    readComposerText(composer) {
      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        return composer.value;
      }
      return composer.innerText || composer.textContent || "";
    }
    findSendControl(root = document) {
      return queryFirst(
        [
          'button[aria-label="Submit" i]',
          'button[aria-label="Send" i]',
          'button[type="submit"]'
        ],
        root
      );
    }
    findStopControl(root = document) {
      return queryFirst(['button[aria-label="Stop" i]'], root);
    }
    collectVisibleMessages(root = document) {
      const turns = queryAll(
        [
          ".query-wrapper",
          ".answer-wrapper",
          '[data-testid*="thread-item"]',
          ".conversation-turn"
        ],
        root
      );
      const messages = [];
      turns.forEach((turn, index) => {
        let role = "unknown";
        if (turn.classList.contains("query-wrapper")) {
          role = "user";
        } else if (turn.classList.contains("answer-wrapper")) {
          role = "assistant";
        } else {
          role = determineSemanticRole(turn);
        }
        const text = normalizeMessageText(turn);
        if (text) {
          messages.push({
            id: turn.getAttribute("data-message-id") || `pplx_${index}`,
            role,
            text,
            index,
            source: role === "unknown" ? "fallback" : "semantic"
          });
        }
      });
      return messages;
    }
    getConversationId(url, _root) {
      const parts = url.pathname.split("/").filter(Boolean);
      const searchIndex = parts.indexOf("search");
      if (searchIndex !== -1 && parts[searchIndex + 1]) {
        return `perplexity:${parts[searchIndex + 1]}`;
      }
      return parts.length > 0 ? `perplexity:${parts[parts.length - 1]}` : "perplexity:new";
    }
    getQuotaSignals(root = document) {
      const alert = queryFirst(['[role="alert"]', ".pro-usage-alert"], root);
      if (!alert || !alert.textContent) return null;
      return parseQuotaHintsFromText(alert.textContent);
    }
    getAttachmentDescriptors(root = document) {
      const items = queryAll(['[data-testid*="file-upload"]', ".attachment-pill"], root);
      return items.map((item, idx) => ({
        name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
        tokenProvenance: "unknown"
      }));
    }
  };

  // src/adapters/grok.ts
  var GrokAdapter = class {
    site = "grok";
    label = "Grok";
    matches(url) {
      return url.hostname === "grok.com" || url.hostname.endsWith(".grok.com") || url.hostname === "x.com" && url.pathname.startsWith("/i/grok");
    }
    detectModel(root = document) {
      const el = queryFirst(['button[aria-label*="model" i]', '[data-testid*="grok-model"]'], root);
      const rawName = el?.textContent?.trim() || void 0;
      return {
        rawName,
        label: rawName ? compactWhitespace(rawName) : void 0,
        isKnown: Boolean(rawName)
      };
    }
    findComposer(root = document) {
      return queryFirst(
        [
          'textarea[placeholder*="Ask Grok" i]',
          'div[contenteditable="true"][aria-label*="Grok" i]',
          "textarea",
          'div[contenteditable="true"]'
        ],
        root
      );
    }
    readComposerText(composer) {
      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        return composer.value;
      }
      return composer.innerText || composer.textContent || "";
    }
    findSendControl(root = document) {
      return queryFirst(
        [
          'button[aria-label="Grok something" i]',
          'button[aria-label="Send" i]',
          'button[data-testid*="send"]'
        ],
        root
      );
    }
    findStopControl(root = document) {
      return queryFirst(['button[aria-label="Stop" i]'], root);
    }
    collectVisibleMessages(root = document) {
      const turns = queryAll(
        [
          '[data-testid*="grok-message"]',
          '[data-testid*="conversation-turn"]',
          ".message-bubble"
        ],
        root
      );
      const messages = [];
      turns.forEach((turn, index) => {
        const role = determineSemanticRole(turn);
        const text = normalizeMessageText(turn);
        if (text) {
          messages.push({
            id: turn.getAttribute("data-message-id") || `grok_${index}`,
            role,
            text,
            index,
            source: role === "unknown" ? "fallback" : "semantic"
          });
        }
      });
      return messages;
    }
    getConversationId(url, _root) {
      const parts = url.pathname.split("/").filter(Boolean);
      return parts.length > 0 ? `grok:${parts[parts.length - 1]}` : "grok:new";
    }
    getQuotaSignals(root = document) {
      const alert = queryFirst(['[role="alert"]', ".rate-limit-warning"], root);
      if (!alert || !alert.textContent) return null;
      return parseQuotaHintsFromText(alert.textContent);
    }
    getAttachmentDescriptors(root = document) {
      const items = queryAll(['[data-testid*="attachment"]'], root);
      return items.map((item, idx) => ({
        name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
        tokenProvenance: "unknown"
      }));
    }
  };

  // src/adapters/index.ts
  var ADAPTERS = [
    new ChatGPTAdapter(),
    new ClaudeAdapter(),
    new GeminiAdapter(),
    new PerplexityAdapter(),
    new GrokAdapter()
  ];
  function getAdapterForUrl(url) {
    for (const adapter2 of ADAPTERS) {
      if (adapter2.matches(url)) {
        return adapter2;
      }
    }
    return null;
  }

  // src/capture/stateMachine.ts
  function estimateTokens(text) {
    const engine = globalThis.YorTokenAccuracy;
    if (engine?.estimateTokenBreakdown) {
      return engine.estimateTokenBreakdown(text).total;
    }
    return Math.ceil((text?.length || 0) / 4);
  }
  function makeMeasurement(provider, model, source) {
    const engine = globalThis.YorTokenAccuracy;
    if (engine?.createMeasurement) {
      return engine.createMeasurement({ provider, model, source });
    }
    return {
      measurementLevel: "approximation",
      tokenizer: "none",
      confidence: "estimated",
      errorMarginPercent: 40
    };
  }
  var CaptureStateMachine = class {
    state = "IDLE";
    pending = null;
    adapter;
    onCommit;
    constructor(adapter2, onCommit) {
      this.adapter = adapter2;
      this.onCommit = onCommit;
    }
    getState() {
      return this.state;
    }
    getPending() {
      return this.pending;
    }
    /**
     * Called when the user types in composer.
     */
    onUserTyping(text) {
      if (this.state === "IDLE" || this.state === "DRAFTING") {
        this.state = text.trim().length > 0 ? "DRAFTING" : "IDLE";
      }
    }
    /**
     * Called when user clicks send or presses Enter.
     */
    onUserSubmit(promptText, model, threadId, visibleMessages) {
      const trimmed = promptText.trim();
      if (!trimmed) return false;
      const promptTokens = estimateTokens(trimmed);
      const knownAssistantIds = /* @__PURE__ */ new Set();
      visibleMessages.filter((m) => m.role === "assistant").forEach((m) => knownAssistantIds.add(m.id));
      this.pending = {
        id: uid("exch"),
        clientEventId: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid("cli"),
        threadId,
        model,
        promptText: trimmed,
        promptTokens,
        promptChars: trimmed.length,
        startedAt: Date.now(),
        awaitingThreadAssignment: threadId.endsWith(":new") || threadId.endsWith(":root"),
        knownAssistantIds
      };
      this.state = "SUBMITTED";
      return true;
    }
    /**
     * Evaluates DOM updates to progress state:
     * Checks stop controls, new assistant messages, error banners, rate limits.
     */
    onDomUpdate(root, currentUrl, visibleMessages, quotaSignal) {
      if (!this.pending) {
        if (this.state !== "IDLE" && this.state !== "DRAFTING") {
          this.state = "IDLE";
        }
        return;
      }
      const now = Date.now();
      const currentThreadId = this.adapter.getConversationId(currentUrl, root);
      if (currentThreadId !== this.pending.threadId) {
        if (this.pending.awaitingThreadAssignment) {
          const userMatches = visibleMessages.some(
            (m) => m.role === "user" && compactWhitespace(m.text) === compactWhitespace(this.pending.promptText)
          );
          if (userMatches) {
            this.pending.threadId = currentThreadId;
            this.pending.awaitingThreadAssignment = false;
          } else {
            this.state = "ABANDONED";
            this.pending = null;
            return;
          }
        } else {
          this.state = "ABANDONED";
          this.pending = null;
          return;
        }
      }
      if (quotaSignal && quotaSignal.status === "limited") {
        this.transitionToRateLimited(quotaSignal.rateLimitMessage);
        return;
      }
      const isGenerating = Boolean(this.adapter.findStopControl(root));
      const assistantMessages = visibleMessages.filter(
        (m) => m.role === "assistant" && !this.pending.knownAssistantIds.has(m.id)
      );
      const latestAssistant = assistantMessages.at(-1);
      if (this.state === "SUBMITTED") {
        this.state = "AWAITING_RESPONSE";
      }
      if (isGenerating || latestAssistant && latestAssistant.text.length > 0) {
        this.state = "STREAMING";
        this.pending.lastStreamingAt = now;
        if (latestAssistant) {
          this.pending.lastAssistantText = latestAssistant.text;
        }
      }
      if (!isGenerating && this.state === "STREAMING" && this.pending.lastAssistantText) {
        this.transitionToCompleted(this.pending.lastAssistantText);
        return;
      }
      if (now - this.pending.startedAt > 10 * 6e4) {
        this.state = "ABANDONED";
        this.pending = null;
      }
    }
    /**
     * Explicitly handles user stopping or interrupting generation.
     */
    onUserCancel() {
      if (this.pending && this.pending.lastAssistantText) {
        this.transitionToCompleted(this.pending.lastAssistantText);
      } else {
        this.state = "ABANDONED";
        this.pending = null;
      }
    }
    transitionToCompleted(assistantText) {
      if (!this.pending) return;
      const outputTokens = estimateTokens(assistantText);
      const measurement = makeMeasurement(this.adapter.site, this.pending.model, "visible provider DOM response");
      const committed = {
        id: this.pending.id,
        clientEventId: this.pending.clientEventId,
        site: this.adapter.site,
        model: this.pending.model,
        threadId: this.pending.threadId,
        timestamp: Date.now(),
        promptTokens: this.pending.promptTokens,
        outputTokens,
        totalTokens: this.pending.promptTokens + outputTokens,
        promptChars: this.pending.promptChars,
        outputChars: assistantText.length,
        status: "completed",
        accuracy: measurement.measurementLevel === "deterministic_local" ? "exact" : "calibrated",
        measurement
      };
      this.state = "COMPLETED";
      this.pending = null;
      this.onCommit(committed);
      this.state = "IDLE";
    }
    transitionToRateLimited(_message) {
      if (!this.pending) return;
      const measurement = makeMeasurement(this.adapter.site, this.pending.model, "provider rate limit signal");
      const committed = {
        id: this.pending.id,
        clientEventId: this.pending.clientEventId,
        site: this.adapter.site,
        model: this.pending.model,
        threadId: this.pending.threadId,
        timestamp: Date.now(),
        promptTokens: this.pending.promptTokens,
        outputTokens: 0,
        totalTokens: this.pending.promptTokens,
        promptChars: this.pending.promptChars,
        outputChars: 0,
        status: "rate_limited",
        accuracy: "estimated",
        measurement
      };
      this.state = "RATE_LIMITED";
      this.pending = null;
      this.onCommit(committed);
      this.state = "IDLE";
    }
  };

  // src/overlay/overlay-position.ts
  var DEFAULT_PADDING = 12;
  var DEFAULT_GAP = 8;
  function finite(value, fallback) {
    return Number.isFinite(value) ? Number(value) : fallback;
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function getOverlayPosition(anchor, viewport, overlay, options = {}) {
    const padding = Math.max(0, finite(options.padding, DEFAULT_PADDING));
    const gap = Math.max(0, finite(options.gap, DEFAULT_GAP));
    const width = Math.max(0, finite(overlay?.width, 0));
    const height = Math.max(0, finite(overlay?.height, 0));
    const viewportWidth = Math.max(0, finite(viewport?.width, 0));
    const viewportHeight = Math.max(0, finite(viewport?.height, 0));
    const left = clamp(finite(anchor?.left, padding), padding, Math.max(padding, viewportWidth - width - padding));
    const belowTop = finite(anchor?.bottom, padding) + gap;
    const aboveTop = finite(anchor?.top, padding) - gap - height;
    const anchorVisible = anchor?.bottom > 0 && anchor?.top < viewportHeight;
    const fitsWidth = width <= viewportWidth - padding * 2;
    const fitsBelow = anchorVisible && fitsWidth && belowTop >= padding && belowTop + height <= viewportHeight - padding;
    const fitsAbove = anchorVisible && fitsWidth && aboveTop >= padding && aboveTop + height <= viewportHeight - padding;
    if (fitsBelow) {
      return { left, top: belowTop, placement: "below" };
    }
    if (fitsAbove) {
      return { left, top: aboveTop, placement: "above" };
    }
    return {
      left,
      top: clamp(belowTop, padding, Math.max(padding, viewportHeight - height - padding)),
      placement: "hidden"
    };
  }
  function applyOverlayPosition(element, anchor, viewport, overlay, options) {
    const position = getOverlayPosition(anchor, viewport, overlay, options);
    if (element?.style) {
      element.style.left = `${position.left}px`;
      element.style.top = `${position.top}px`;
      element.style.bottom = "auto";
      element.style.right = "auto";
      element.style.visibility = position.placement === "hidden" ? "hidden" : "";
    }
    if (element?.dataset) {
      element.dataset.placement = position.placement;
    }
    return position;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.YorOverlayPosition = { applyOverlayPosition, getOverlayPosition };
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { applyOverlayPosition, getOverlayPosition };
  }

  // src/content/index.ts
  function getDraftTokenBreakdown(text, attachments = []) {
    const engine = globalThis.YorTokenAccuracy;
    if (engine?.estimateTokenBreakdown) {
      return engine.estimateTokenBreakdown(text, attachments);
    }
    const total = Math.ceil((text?.length || 0) / 4);
    return {
      total,
      sections: [{ name: "composer", tokens: total }],
      measurement: {
        measurementLevel: "approximation",
        tokenizer: "none",
        confidence: "estimated",
        errorMarginPercent: 40
      }
    };
  }
  function getMeasurement(provider, model) {
    const engine = globalThis.YorTokenAccuracy;
    if (engine?.createMeasurement) {
      return engine.createMeasurement({ provider, model });
    }
    return {
      measurementLevel: "approximation",
      tokenizer: "none",
      confidence: "estimated",
      errorMarginPercent: 40
    };
  }
  function formatRemainingDuration(targetMs, now) {
    const diffMs = Math.max(0, targetMs - now);
    const totalMins = Math.round(diffMs / 6e4);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0 && mins > 0) {
      return `~${hours}h ${mins}m`;
    }
    if (hours > 0) {
      return `~${hours}h`;
    }
    if (mins > 0) {
      return `~${mins}m`;
    }
    return "<1m";
  }
  function parseAnchor(timeStr) {
    if (!timeStr) return { hours: 0, minutes: 0 };
    const [h, m] = timeStr.split(":").map((v) => Number.parseInt(v, 10) || 0);
    return { hours: h ?? 0, minutes: m ?? 0 };
  }
  function getUtcDailyWindowBounds(rule, now) {
    const { hours, minutes } = parseAnchor(rule?.anchorLocalTime);
    const current = new Date(now);
    const anchor = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), hours, minutes, 0, 0);
    const start = anchor > now ? anchor - 864e5 : anchor;
    return { start, end: start + 864e5 };
  }
  function getUtcWeeklyWindowBounds(rule, now) {
    const targetDay = rule?.dayOfWeek ?? 1;
    const { hours, minutes } = parseAnchor(rule?.anchorLocalTime);
    const current = new Date(now);
    const anchorToday = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), hours, minutes, 0, 0);
    const delta = (current.getUTCDay() - targetDay + 7) % 7;
    let start = anchorToday - delta * 864e5;
    if (start > now) start -= 7 * 864e5;
    return { start, end: start + 7 * 864e5 };
  }
  function getCurrentWindowBounds(rule, now = Date.now()) {
    return getUtcWeeklyWindowBounds(rule, now);
  }
  function predictReset(options) {
    const { now, rule, explicitResetAt } = options;
    if (explicitResetAt && explicitResetAt > now) {
      return { resetAt: explicitResetAt, confidence: "provider_reported" };
    }
    if (!rule || rule.inferred) {
      return { resetAt: void 0, confidence: "unknown" };
    }
    if (rule.kind === "weekly") {
      const bounds = getUtcWeeklyWindowBounds(rule, now);
      return { resetAt: bounds.end, confidence: "estimated" };
    }
    if (rule.kind === "daily") {
      const bounds = getUtcDailyWindowBounds(rule, now);
      return { resetAt: bounds.end, confidence: "estimated" };
    }
    return { resetAt: void 0, confidence: "unknown" };
  }
  function computeQuotaStatus(options) {
    const { now, explicitResetAt, rule } = options;
    const resetInfo = predictReset({ now, rule, explicitResetAt });
    return {
      status: explicitResetAt && explicitResetAt > now ? "limited" : "ok",
      accuracy: explicitResetAt ? "provider_reported" : "estimated",
      resetAt: resetInfo.resetAt
    };
  }
  var SelectorSiteAdapter = class {
    constructor(config) {
      this.config = config;
    }
    config;
  };
  function getAdapterForCurrentSite() {
    if (typeof window !== "undefined" && window.location) {
      return getAdapterForUrl(new URL(window.location.href));
    }
    return null;
  }
  var adapter = getAdapterForCurrentSite();
  globalThis.parseQuotaHintsFromText = parseQuotaHintsFromText;
  globalThis.predictReset = predictReset;
  globalThis.computeQuotaStatus = computeQuotaStatus;
  globalThis.SelectorSiteAdapter = SelectorSiteAdapter;
  async function init() {
    const url = new URL(window.location.href);
    const siteAdapter = getAdapterForUrl(url);
    if (!siteAdapter) return;
    const activeAdapter = siteAdapter;
    let sitePreferences = null;
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        const snapshot = await chrome.runtime.sendMessage({ type: "get-snapshot" });
        sitePreferences = snapshot?.state?.preferences?.sites?.[activeAdapter.site] ?? null;
      }
    } catch {
    }
    let collapsed = true;
    let overlayVisible = true;
    const onCommitExchange = (event) => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: "commit-usage-event",
          event
        }).catch(() => void 0);
      }
    };
    const stateMachine = new CaptureStateMachine(activeAdapter, onCommitExchange);
    const container = document.createElement("div");
    container.className = "yor-token-usage-root";
    container.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647;
    pointer-events: none;
    overflow: visible;
  `;
    const shadow = container.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      pointer-events: none;
      overflow: visible;
    }
    * { box-sizing: border-box; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    }
    .yor-usage-window {
      position: fixed;
      pointer-events: auto;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      color: #dedbd4;
      background: #171719;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 8px 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 12px;
      user-select: none;
      cursor: pointer;
      line-height: 1.3;
    }
    .yor-usage-window:focus-visible, .yor-card button:focus-visible {
      outline: 2px solid #8fdcc4;
      outline-offset: 2px;
    }
    .yor-meter-stat {
      display: flex;
      flex-direction: column;
    }
    .yor-meter-stat span {
      font-size: 10px;
      text-transform: uppercase;
      color: #888;
    }
    .yor-meter-stat strong {
      color: #8fdcc4;
    }
    .yor-card {
      position: fixed;
      pointer-events: auto;
      background: #171719;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 16px;
      width: min(320px, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      color: #dedbd4;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      display: none;
      flex-direction: column;
      gap: 12px;
    }
    .yor-card.yor-open {
      display: flex;
    }
    .yor-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .yor-card button {
      background: #242426;
      color: #dedbd4;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
    }
    .yor-card button.primary {
      background: #8fdcc4;
      color: #101011;
      font-weight: 600;
    }
  `;
    shadow.append(style);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
    <button class="yor-usage-window" data-action="toggle" data-ref="pageMeter" title="Open Yor Token Usage details">
      <span class="yor-meter-stat">
        <span>Quota</span>
        <strong data-ref="meterPercent">Unknown</strong>
      </span>
      <span class="yor-meter-stat">
        <span>Tokens</span>
        <strong data-ref="meterTokens">Not detected</strong>
      </span>
      <span class="yor-meter-stat">
        <span>Reset</span>
        <strong data-ref="meterReset">Unknown</strong>
      </span>
    </button>
    <div class="yor-card" data-ref="card">
      <div class="yor-card-head">
        <strong>Yor Token Usage</strong>
        <button data-action="toggle" data-ref="toggleButton">Close</button>
      </div>
      <div>
        <span data-ref="quickCost">Cost proxy unavailable</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button data-ref="copyShorterButton">Copy shorter</button>
      </div>
    </div>
  `;
    shadow.append(wrapper);
    document.documentElement.appendChild(container);
    const pageMeter = shadow.querySelector('[data-ref="pageMeter"]');
    const card = shadow.querySelector('[data-ref="card"]');
    const meterTokens = shadow.querySelector('[data-ref="meterTokens"]');
    const meterPercent = shadow.querySelector('[data-ref="meterPercent"]');
    const meterReset = shadow.querySelector('[data-ref="meterReset"]');
    function positionOverlay() {
      if (!overlayVisible) return;
      const composer = activeAdapter.findComposer();
      if (!composer) return;
      const anchor = composer.closest("form") || composer;
      const anchorRect = anchor.getBoundingClientRect();
      const viewportRect = { width: window.innerWidth, height: window.innerHeight };
      const maxWidth = Math.max(0, window.innerWidth - 24);
      const availableHeight = Math.max(anchorRect.top - 20, window.innerHeight - anchorRect.bottom - 20);
      if (collapsed) {
        pageMeter.style.display = "flex";
        card.classList.remove("yor-open");
        pageMeter.style.maxWidth = `${maxWidth}px`;
        const meterRect = pageMeter.getBoundingClientRect();
        applyOverlayPosition(pageMeter, anchorRect, viewportRect, {
          width: meterRect.width || 250,
          height: meterRect.height || 44
        });
      } else {
        pageMeter.style.display = "none";
        card.classList.add("yor-open");
        card.style.maxWidth = `${maxWidth}px`;
        card.style.width = `${Math.min(320, maxWidth)}px`;
        card.style.maxHeight = `${Math.max(120, availableHeight)}px`;
        const cardRect = card.getBoundingClientRect();
        applyOverlayPosition(card, anchorRect, viewportRect, {
          width: cardRect.width || Math.min(320, maxWidth),
          height: cardRect.height || 140
        });
      }
    }
    shadow.addEventListener("click", (event) => {
      const target = event.target;
      const toggleBtn = target?.closest('[data-action="toggle"]');
      if (toggleBtn) {
        collapsed = !collapsed;
        positionOverlay();
        return;
      }
    });
    function doUpdateObservation() {
      const composer = activeAdapter.findComposer();
      const draftText = composer ? activeAdapter.readComposerText(composer) : "";
      const attachments = activeAdapter.getAttachmentDescriptors();
      const visibleMessages = activeAdapter.collectVisibleMessages();
      let quota = activeAdapter.getQuotaSignals();
      const modelInfo = activeAdapter.detectModel();
      const threadId = activeAdapter.getConversationId(new URL(window.location.href));
      const alertEl = document.querySelector('[role="alert"], .alert, [data-testid="rate-limit-banner"]');
      if (alertEl && alertEl.textContent) {
        const alertQuota = parseQuotaHintsFromText(alertEl.textContent);
        if (alertQuota.status === "limited" || alertQuota.resetAt) {
          quota = { ...quota, ...alertQuota };
        }
      }
      const hasContent = draftText.trim().length > 0 || visibleMessages.length > 0;
      if (!hasContent) {
        meterTokens.textContent = "Not detected";
        meterReset.textContent = "Unknown";
        meterPercent.textContent = "Unknown";
      } else {
        const draftBreakdown2 = getDraftTokenBreakdown(draftText, attachments);
        const visibleTokens2 = visibleMessages.reduce((sum, m) => sum + Math.ceil(m.text.length / 4), 0);
        const totalTokens = visibleTokens2 + draftBreakdown2.total;
        meterTokens.textContent = `${totalTokens > 0 ? totalTokens : draftBreakdown2.total}`;
        meterPercent.textContent = quota?.percentUsed !== void 0 ? `${quota.percentUsed}%` : "Unknown";
        if (quota?.resetAt && quota.resetAt > Date.now()) {
          meterReset.textContent = formatRemainingDuration(quota.resetAt, Date.now());
        } else if (sitePreferences?.resetRule && !sitePreferences.resetRule.inferred) {
          const pred = predictReset({ now: Date.now(), rule: sitePreferences.resetRule });
          if (pred.resetAt && pred.resetAt > Date.now()) {
            meterReset.textContent = formatRemainingDuration(pred.resetAt, Date.now());
          } else {
            meterReset.textContent = "Unknown";
          }
        } else {
          meterReset.textContent = "Unknown";
        }
      }
      positionOverlay();
      const draftBreakdown = getDraftTokenBreakdown(draftText, attachments);
      const visibleTokens = visibleMessages.reduce((sum, m) => sum + Math.ceil(m.text.length / 4), 0);
      const draftAnalysis = {
        inputTokens: draftBreakdown.total,
        sections: draftBreakdown.sections,
        measurement: draftBreakdown.measurement,
        largePaste: draftText.length > 5e3
      };
      const contextAccounting = {
        visibleThreadTokens: visibleTokens,
        visibleMessageCount: visibleMessages.length,
        estimatedCurrentContextTokens: visibleTokens + draftBreakdown.total,
        contextPressureTier: "low",
        measurement: getMeasurement(activeAdapter.site, modelInfo.label || "unknown")
      };
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: "submit-tab-observation",
          site: activeAdapter.site,
          threadId,
          model: modelInfo.label || "unknown",
          draftText,
          draftAnalysis,
          contextAccounting,
          quotaSignal: quota
        }).catch(() => void 0);
      }
    }
    const updateObservation = debounce(doUpdateObservation, 100);
    doUpdateObservation();
    document.addEventListener("input", (event) => {
      const composer = activeAdapter.findComposer();
      if (composer && (composer === event.target || composer.contains(event.target))) {
        const text = activeAdapter.readComposerText(composer);
        stateMachine.onUserTyping(text);
        updateObservation();
      }
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      const sendBtn = activeAdapter.findSendControl();
      if (sendBtn && (target === sendBtn || sendBtn.contains(target))) {
        const composer = activeAdapter.findComposer();
        const text = composer ? activeAdapter.readComposerText(composer) : "";
        const model = activeAdapter.detectModel().label || "unknown";
        const threadId = activeAdapter.getConversationId(new URL(window.location.href));
        const messages = activeAdapter.collectVisibleMessages();
        stateMachine.onUserSubmit(text, model, threadId, messages);
        updateObservation();
      }
    }, true);
    const observer = new MutationObserver(() => {
      const visibleMessages = activeAdapter.collectVisibleMessages();
      const quota = activeAdapter.getQuotaSignals();
      stateMachine.onDomUpdate(document.body, new URL(window.location.href), visibleMessages, quota);
      updateObservation();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", () => positionOverlay());
    window.addEventListener("scroll", () => positionOverlay(), true);
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg?.type === "toggle-overlay") {
          overlayVisible = msg.value !== void 0 ? msg.value : !overlayVisible;
          container.style.display = overlayVisible ? "" : "none";
          sendResponse({ ok: true, visible: overlayVisible });
        }
      });
    }
    updateObservation();
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => void init());
    } else {
      void init();
    }
  }
})();
