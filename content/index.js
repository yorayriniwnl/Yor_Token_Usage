(() => {
  // src/lib/utils.ts
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function sum(values) {
    return values.reduce((acc, value) => acc + value, 0);
  }
  function round(value, digits = 0) {
    const precision = 10 ** digits;
    return Math.round(value * precision) / precision;
  }
  function uid(prefix = "yor") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }
  function debounce(fn, delay = 200) {
    let timeout = 0;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
  function hashString(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }
  function compactWhitespace(input) {
    return input.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  function unique(items) {
    return Array.from(new Set(items));
  }
  function humanFileSize(bytes) {
    if (!bytes || bytes <= 0) return "Unknown size";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${round(value, value < 10 ? 1 : 0)} ${units[unitIndex]}`;
  }
  function truncate(text, limit = 120) {
    return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}\u2026`;
  }

  // src/adapters/base.ts
  function queryFirst(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }
  function queryAll(selectors, root = document) {
    const elements = [];
    for (const selector of selectors) {
      elements.push(...Array.from(root.querySelectorAll(selector)));
    }
    return Array.from(new Set(elements));
  }
  function sortByDomOrder(nodes) {
    return [...nodes].sort((a, b) => {
      if (a === b) return 0;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
    });
  }
  function textFromNode(node) {
    const input = node;
    const directValue = typeof input.value === "string" ? input.value : "";
    const content = directValue || node.innerText || node.textContent || "";
    return content.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  function selectorMatches(node, selectors) {
    return selectors.some((selector) => {
      try {
        return node.matches(selector);
      } catch {
        return false;
      }
    });
  }
  function closestSelectorMatches(node, selectors) {
    return selectors.some((selector) => {
      try {
        return Boolean(node.closest(selector));
      } catch {
        return false;
      }
    });
  }
  function roleHintFromNode(node, fallbackIndex = 0) {
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
    return fallbackIndex % 2 === 0 ? "user" : "assistant";
  }
  function normalizeMessageText(node) {
    return compactWhitespace(textFromNode(node));
  }
  function cleanModelName(value) {
    if (!value) return void 0;
    return value.replace(/\s+/g, " ").replace(/\bnew\b/gi, "").trim().slice(0, 80) || void 0;
  }
  function parseRelativeReset(text) {
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
    if (!normalized) return {};
    const limited = /(?:usage|rate|message|token) limit|too many requests|try again later|quota/i.test(normalized);
    const remainingMatch = normalized.match(/(\d[\d,]*)\s+(?:tokens|messages)\s+remaining/i);
    const percentMatch = normalized.match(/(\d{1,3})\s*%\s*(?:used|remaining)/i);
    const tierMatch = normalized.match(/\b(plus|pro|advanced|premium|free)\b/i);
    return {
      resetAt: parseRelativeReset(normalized),
      rateLimitMessage: limited ? normalized.slice(0, 220) : void 0,
      remainingTokens: remainingMatch ? Number.parseInt(remainingMatch[1].replace(/,/g, ""), 10) : void 0,
      percentUsed: percentMatch ? Number.parseInt(percentMatch[1], 10) : void 0,
      quotaTier: tierMatch?.[1] ? tierMatch[1][0].toUpperCase() + tierMatch[1].slice(1).toLowerCase() : void 0,
      status: limited ? "limited" : void 0,
      confidence: limited || remainingMatch || percentMatch ? 0.72 : 0.2
    };
  }
  function inferThreadIdFromLocation(site) {
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const queryThread = url.searchParams.get("conversation") || url.searchParams.get("thread");
    if (queryThread) return queryThread;
    if (pathParts.length) return `${site}:${pathParts[pathParts.length - 1]}`;
    return `${site}:root`;
  }
  var SelectorSiteAdapter = class {
    site;
    label;
    config;
    constructor(config) {
      this.config = config;
      this.site = config.site;
      this.label = config.label;
    }
    matches(url) {
      return this.config.hostnames.some((hostname) => url.hostname === hostname || url.hostname.endsWith(`.${hostname}`));
    }
    getComposer() {
      return queryFirst(this.config.composer);
    }
    readComposerText() {
      const composer = this.getComposer();
      return composer ? textFromNode(composer) : "";
    }
    getSendButton() {
      return queryFirst(this.config.sendButton);
    }
    getConversationRoot() {
      return queryFirst(this.config.conversationRoot) ?? document.body;
    }
    collectMessages() {
      const root = this.getConversationRoot();
      const now = Date.now();
      const messages = [];
      const seen = /* @__PURE__ */ new Set();
      const pushMessage = (node, role, index, source, minimumLength = 2) => {
        const text = normalizeMessageText(node);
        if (text.length < minimumLength) return;
        if (/^(copy|retry|edit|share|thumbs up|thumbs down)$/i.test(text)) return;
        const identity = `${role}:${hashString(text)}`;
        if (seen.has(identity)) return;
        seen.add(identity);
        messages.push({
          id: `${role}_${hashString(`${source}:${text}:${index}`)}`,
          role,
          text,
          timestamp: now,
          node
        });
      };
      const exactCandidates = [
        ...queryAll(this.config.userMessage, root).map((node) => ({ node, role: "user" })),
        ...queryAll(this.config.assistantMessage, root).map((node) => ({ node, role: "assistant" }))
      ].sort((a, b) => a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1).map((entry, index) => ({ ...entry, index }));
      exactCandidates.forEach(({ node, role, index }) => pushMessage(node, role, index, "exact"));
      const hasUser = messages.some((message) => message.role === "user");
      const hasAssistant = messages.some((message) => message.role === "assistant");
      if (!hasUser || !hasAssistant || messages.length < 2) {
        const genericSelectors = [
          "[data-message-author-role]",
          "[data-is-author]",
          "[data-testid*='message']",
          "[data-testid*='conversation-turn']",
          "article",
          ".message",
          ".prose",
          "[class*='font-claude']",
          "[class*='font-user']"
        ];
        sortByDomOrder(queryAll(genericSelectors, root)).forEach((node, index) => {
          const role = selectorMatches(node, this.config.userMessage) || closestSelectorMatches(node, this.config.userMessage) ? "user" : selectorMatches(node, this.config.assistantMessage) || closestSelectorMatches(node, this.config.assistantMessage) ? "assistant" : roleHintFromNode(node, index);
          pushMessage(node, role, index, "generic", 12);
        });
      }
      return messages.sort((a, b) => a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1).map(({ node, ...message }) => message).slice(-40);
    }
    getModelName() {
      const modelElement = queryFirst(this.config.model);
      return cleanModelName(modelElement?.innerText || modelElement?.textContent || void 0);
    }
    getThreadId() {
      return inferThreadIdFromLocation(this.site);
    }
    getAttachmentDescriptors() {
      return queryAll(this.config.attachment).map((node) => {
        const name = textFromNode(node).slice(0, 120) || node.getAttribute("aria-label") || "Attachment";
        const sizeHint = node.getAttribute("data-size") || node.getAttribute("aria-description") || "";
        const sizeMatch = sizeHint.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i);
        let sizeBytes;
        if (sizeMatch) {
          const value = Number.parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2].toUpperCase();
          sizeBytes = unit === "GB" ? value * 1024 ** 3 : unit === "MB" ? value * 1024 ** 2 : value * 1024;
        }
        return {
          name,
          sizeBytes
        };
      });
    }
    getQuotaHints() {
      const alertNodes = queryAll(this.config.alert);
      const text = alertNodes.map((node) => textFromNode(node)).join(" \u2022 ");
      return parseQuotaHintsFromText(text || document.body.innerText.slice(0, 2e3));
    }
  };

  // src/adapters/chatgpt.ts
  var chatgptAdapter = new SelectorSiteAdapter({
    site: "chatgpt",
    label: "ChatGPT",
    hostnames: ["chatgpt.com", "chat.openai.com"],
    composer: ["#prompt-textarea", 'textarea[data-id="root"]', "textarea", 'div#prompt-textarea[contenteditable="true"]'],
    sendButton: ['button[data-testid="send-button"]', 'button[aria-label*="Send"]'],
    conversationRoot: ["main", '[data-testid="conversation-turns"]', "section"],
    userMessage: ['[data-message-author-role="user"]', 'article [data-message-author-role="user"]'],
    assistantMessage: ['[data-message-author-role="assistant"]', 'article [data-message-author-role="assistant"]'],
    model: ['button[data-testid*="model-switcher"]', 'button[aria-haspopup="menu"]', "header button"],
    attachment: ['[data-testid*="attachment"]', 'button[aria-label*="attachment"]'],
    alert: ['[role="alert"]', '[data-testid="toast"]', ".text-token-text-error"]
  });

  // src/adapters/claude.ts
  var claudeAdapter = new SelectorSiteAdapter({
    site: "claude",
    label: "Claude",
    hostnames: ["claude.ai"],
    composer: ['div[contenteditable="true"][aria-label*="Message"]', 'div.ProseMirror[contenteditable="true"]', "textarea"],
    sendButton: ['button[aria-label*="Send"]', 'button[data-testid*="send"]'],
    conversationRoot: ["main", "section", '[data-testid*="conversation"]'],
    userMessage: ['[data-testid="user-message"]', '[data-testid*="user-message"]', 'div[data-is-author="human"]', '[data-is-author="human"]', '[data-testid*="human-message"]', '[class*="font-user-message"]'],
    assistantMessage: ['[data-testid="assistant-message"]', '[data-testid*="assistant-message"]', 'div[data-is-author="assistant"]', '[data-is-author="assistant"]', '[data-testid*="ai-message"]', '[class*="font-claude-message"]'],
    model: ['button[data-testid*="model"]', "header button", 'button[aria-haspopup="menu"]'],
    attachment: ['button[aria-label*="attachment"]', '[data-testid*="attachment"]'],
    alert: ['[role="alert"]', '[data-testid*="warning"]', ".text-danger"]
  });

  // src/adapters/gemini.ts
  var geminiAdapter = new SelectorSiteAdapter({
    site: "gemini",
    label: "Gemini",
    hostnames: ["gemini.google.com"],
    composer: ["textarea", 'div[contenteditable="true"]'],
    sendButton: ['button[aria-label*="Send"]', 'button[mattooltip*="Send"]'],
    conversationRoot: ["main", "chat-app", '[role="main"]'],
    userMessage: ["user-query", '[data-test-id*="user"]'],
    assistantMessage: ["model-response", '[data-test-id*="response"]'],
    model: ['button[aria-haspopup="menu"]', "header button"],
    attachment: ['button[aria-label*="attachment"]', "upload-chip"],
    alert: ['[role="alert"]', "snack-bar-container"]
  });

  // src/adapters/grok.ts
  var grokAdapter = new SelectorSiteAdapter({
    site: "grok",
    label: "Grok",
    hostnames: ["grok.com", "x.com"],
    composer: ["textarea", 'div[contenteditable="true"]'],
    sendButton: ['button[aria-label*="Send"]', 'button[type="submit"]'],
    conversationRoot: ["main", '[role="main"]'],
    userMessage: ['[data-testid*="user-message"]', '[data-message-author-role="user"]'],
    assistantMessage: ['[data-testid*="assistant-message"]', '[data-message-author-role="assistant"]'],
    model: ['button[aria-haspopup="menu"]', "header button"],
    attachment: ['button[aria-label*="attachment"]'],
    alert: ['[role="alert"]', '[data-testid*="warning"]']
  });

  // src/adapters/perplexity.ts
  var perplexityAdapter = new SelectorSiteAdapter({
    site: "perplexity",
    label: "Perplexity",
    hostnames: ["perplexity.ai", "www.perplexity.ai"],
    composer: ["textarea", 'div[contenteditable="true"]'],
    sendButton: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]', 'button[type="submit"]'],
    conversationRoot: ["main", '[data-testid*="thread"]', '[role="main"]'],
    userMessage: ['[data-testid*="user-message"]', '[data-message-author-role="user"]'],
    assistantMessage: ['[data-testid*="assistant-message"]', '[data-message-author-role="assistant"]'],
    model: ['button[aria-haspopup="menu"]', '[data-testid*="mode"]'],
    attachment: ['button[aria-label*="attachment"]', '[data-testid*="attachment"]'],
    alert: ['[role="alert"]', ".toast", '[data-testid*="limit"]']
  });

  // src/adapters/index.ts
  var adapters = [chatgptAdapter, claudeAdapter, geminiAdapter, perplexityAdapter, grokAdapter];
  function getAdapterForCurrentSite() {
    const url = new URL(window.location.href);
    return adapters.find((adapter2) => adapter2.matches(url));
  }

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

  // src/lib/tokenEstimator.ts
  var URL_PATTERN = /https?:\/\/\S+/i;
  function sectionLabel(text, type) {
    const clean = compactWhitespace(text.replace(/```/g, "").replace(/^>+/gm, "").trim());
    const preview = clean.split(" ").slice(0, 4).join(" ");
    return preview ? `${type}: ${preview}` : type;
  }
  function estimateSectionTokens(text, type) {
    const chars = text.length;
    const lines = Math.max(1, text.split("\n").length);
    const punctuation = (text.match(/[,:;()[\]{}]/g) ?? []).length;
    const urls = (text.match(/https?:\/\/\S+/g) ?? []).length;
    const longWords = (text.match(/\b[\w-]{10,}\b/g) ?? []).length;
    const nonAscii = (text.match(/[^\u0000-\u007f]/g) ?? []).length;
    switch (type) {
      case "code":
        return Math.ceil(chars / 2.7 + lines * 0.45 + punctuation * 0.05 + longWords * 0.1);
      case "url":
        return Math.ceil(chars / 6.5 + urls * 6);
      case "instruction":
        return Math.ceil(chars / 4 + lines * 0.25 + punctuation * 0.08);
      case "quote":
        return Math.ceil(chars / 4.2 + lines * 0.15 + nonAscii * 0.05);
      case "attachment":
        return Math.ceil(chars / 7.5 + 12);
      case "prose":
      default:
        return Math.ceil(chars / 4 + punctuation * 0.08 + nonAscii * 0.05 + longWords * 0.08);
    }
  }
  function segmentText(text) {
    const normalized = text.replace(/\r/g, "");
    if (!normalized.trim()) return [];
    const lines = normalized.split("\n");
    const sections = [];
    let position = 0;
    let inCode = false;
    let buffer = "";
    let bufferType = null;
    let bufferStart = 0;
    const flush = (endPos) => {
      if (!bufferType || !buffer.trim()) {
        buffer = "";
        bufferType = null;
        bufferStart = endPos;
        return;
      }
      const content = buffer.trimEnd();
      sections.push({
        label: sectionLabel(content, bufferType),
        type: bufferType,
        tokens: estimateSectionTokens(content, bufferType),
        start: bufferStart,
        end: endPos
      });
      buffer = "";
      bufferType = null;
      bufferStart = endPos;
    };
    lines.forEach((line, index) => {
      const rawLine = index < lines.length - 1 ? `${line}
` : line;
      const trimmed = line.trim();
      const togglesFence = /^```/.test(trimmed);
      let nextType = "prose";
      if (inCode || togglesFence) {
        nextType = "code";
      } else if (/^>\s?/.test(trimmed)) {
        nextType = "quote";
      } else if (trimmed.startsWith("[") && /(attachment|file|image|pdf|csv|docx|sheet)/i.test(trimmed)) {
        nextType = "attachment";
      } else if (URL_PATTERN.test(trimmed) && trimmed.replace(/https?:\/\/\S+/g, "").trim().length < 24) {
        nextType = "url";
      } else if (/^([-*•]|\d+\.)\s/.test(trimmed) || /^(goal|task|context|constraints?|output|format|tone|steps?)\s*:/i.test(trimmed)) {
        nextType = "instruction";
      }
      if (bufferType === null) {
        bufferType = nextType;
        bufferStart = position;
        buffer = rawLine;
      } else if (bufferType === nextType) {
        buffer += rawLine;
      } else {
        flush(position);
        bufferType = nextType;
        bufferStart = position;
        buffer = rawLine;
      }
      position += rawLine.length;
      if (togglesFence) {
        inCode = !inCode;
      }
    });
    flush(position);
    return sections;
  }
  function describeAttachments(attachments) {
    return attachments.map((attachment, index) => {
      const description = `[Attachment ${index + 1}] ${attachment.name}${attachment.sizeBytes ? ` \u2022 ${humanFileSize(attachment.sizeBytes)}` : ""}${attachment.pages ? ` \u2022 ${attachment.pages} pages` : ""}`;
      return {
        label: sectionLabel(description, "attachment"),
        type: "attachment",
        tokens: Math.ceil(description.length / 7 + (attachment.sizeBytes ? attachment.sizeBytes / 65536 : 0) + (attachment.pages ?? 0) * 18),
        start: 0,
        end: description.length
      };
    });
  }
  function estimateOutputTokensFromPrompt(text, inputTokens) {
    const normalized = text.toLowerCase();
    const questionCount = (text.match(/\?/g) ?? []).length;
    const detailBoost = [
      "step by step",
      "in detail",
      "full code",
      "comprehensive",
      "thorough",
      "explain",
      "with examples"
    ].filter((needle) => normalized.includes(needle)).length;
    const conciseBoost = ["brief", "concise", "short answer", "one paragraph", "one sentence"].filter((needle) => normalized.includes(needle)).length;
    const codeBoost = normalized.includes("```") || normalized.includes("typescript") || normalized.includes("javascript") || normalized.includes("python") ? 0.35 : 0;
    const ratio = clamp(0.75 + detailBoost * 0.22 + questionCount * 0.03 + codeBoost - conciseBoost * 0.18, 0.35, 2.8);
    return Math.max(40, Math.round(inputTokens * ratio + questionCount * 6 + 24));
  }
  function estimateTokenBreakdown(text, attachments = []) {
    const sections = [...segmentText(text), ...describeAttachments(attachments)];
    const textTokens = sum(sections.filter((section) => ["prose", "instruction", "quote"].includes(section.type)).map((section) => section.tokens));
    const codeTokens = sum(sections.filter((section) => section.type === "code").map((section) => section.tokens));
    const urlTokens = sum(sections.filter((section) => section.type === "url").map((section) => section.tokens));
    const attachmentTokens = sum(sections.filter((section) => section.type === "attachment").map((section) => section.tokens));
    const totalInputTokens = textTokens + codeTokens + urlTokens + attachmentTokens;
    return {
      textTokens,
      codeTokens,
      urlTokens,
      attachmentTokens,
      estimatedOutputTokens: estimateOutputTokensFromPrompt(text, totalInputTokens),
      total: totalInputTokens,
      sections
    };
  }
  function estimateConversation(messages) {
    let promptTokens = 0;
    let outputTokens = 0;
    const contextGrowth = [];
    for (const message of messages) {
      const tokens = estimateTokenBreakdown(message.text).total;
      if (message.role === "assistant") {
        outputTokens += tokens;
      } else {
        promptTokens += tokens;
      }
      contextGrowth.push(promptTokens + outputTokens);
    }
    return {
      promptTokens,
      outputTokens,
      totalTokens: promptTokens + outputTokens,
      contextGrowth
    };
  }

  // src/lib/promptOptimizer.ts
  var PHRASE_REPLACEMENTS = [
    [/\bplease\b/gi, ""],
    [/\bkindly\b/gi, ""],
    [/\bI would like you to\b/gi, ""],
    [/\bmake sure that\b/gi, "ensure"],
    [/\bin order to\b/gi, "to"],
    [/\bas much as possible\b/gi, ""],
    [/\bvery\b/gi, ""],
    [/\bextremely\b/gi, ""],
    [/\breally\b/gi, ""],
    [/\bjust\b/gi, ""],
    [/\bdo not hesitate to\b/gi, ""],
    [/\bfor the purpose of\b/gi, "for"]
  ];
  function normalizeLine(line) {
    return compactWhitespace(line.toLowerCase().replace(/[“”‘’"'`]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, " "));
  }
  function compressSentence(sentence, mode) {
    let result = sentence;
    for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
      result = result.replace(pattern, replacement);
    }
    result = compactWhitespace(result);
    if (mode === "shorter") {
      result = result.replace(/\b(?:could you|can you|would you|I need you to)\b/gi, "").replace(/\b(?:thank you|thanks)\b/gi, "").replace(/\s+,/g, ",").replace(/\s+\./g, ".");
    }
    return result.trim();
  }
  function uniqueNonEmptyLines(text) {
    const seen = /* @__PURE__ */ new Set();
    const output = [];
    for (const rawLine of text.split(/\n+/)) {
      const line = compactWhitespace(rawLine);
      if (!line) continue;
      const key = normalizeLine(line);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(line);
    }
    return output;
  }
  function splitStructuredSections(lines) {
    const sections = {
      goal: [],
      context: [],
      constraints: [],
      output: []
    };
    for (const line of lines) {
      const normalized = normalizeLine(line);
      if (!sections.goal.length && (line.endsWith("?") || /^(goal|task|objective)\s*:/i.test(line))) {
        sections.goal.push(line.replace(/^(goal|task|objective)\s*:/i, "").trim());
        continue;
      }
      if (/^(format|output|return)\s*:/i.test(line) || /\b(return|respond with|format as|table|json|markdown)\b/i.test(line)) {
        sections.output.push(line.replace(/^(format|output|return)\s*:/i, "").trim());
        continue;
      }
      if (/\b(avoid|must|should|only|do not|don't|without|limit|preserve|keep)\b/i.test(normalized)) {
        sections.constraints.push(line);
        continue;
      }
      sections.context.push(line);
    }
    if (!sections.goal.length && lines.length) {
      sections.goal.push(lines[0]);
      sections.context = lines.slice(1);
    }
    return sections;
  }
  function buildVariant(text, mode) {
    const lines = uniqueNonEmptyLines(text).map((line) => compressSentence(line, mode));
    const structured = splitStructuredSections(lines);
    const contextLimit = mode === "shorter" ? 4 : mode === "balanced" ? 6 : 10;
    const constraintLimit = mode === "shorter" ? 4 : 8;
    const outputLimit = mode === "shorter" ? 3 : 6;
    const parts = [];
    if (structured.goal.length) {
      parts.push(`Goal: ${structured.goal[0]}`);
    }
    if (structured.context.length) {
      parts.push(`Context:
${structured.context.slice(0, contextLimit).map((line) => `- ${line}`).join("\n")}`);
    }
    if (structured.constraints.length) {
      parts.push(`Constraints:
${structured.constraints.slice(0, constraintLimit).map((line) => `- ${line}`).join("\n")}`);
    }
    if (structured.output.length) {
      parts.push(`Output:
${structured.output.slice(0, outputLimit).map((line) => `- ${line}`).join("\n")}`);
    }
    if (mode === "shorter") {
      parts.push("Use the shortest path that preserves accuracy.");
    }
    return compactWhitespace(parts.join("\n\n"));
  }
  function findRepeatedInstructions(text) {
    const lines = text.split(/\n+/).map((line) => compactWhitespace(line)).filter((line) => line.length > 10);
    const counts = /* @__PURE__ */ new Map();
    const repeated = [];
    for (const line of lines) {
      const key = normalizeLine(line);
      if (!key) continue;
      if (counts.has(key)) {
        repeated.push(line);
      } else {
        counts.set(key, line);
      }
    }
    return unique(repeated).slice(0, 6);
  }
  function findRedundantSections(text) {
    const paragraphs = text.split(/\n{2,}/).map((block) => compactWhitespace(block)).filter((block) => block.length > 32);
    const redundant = [];
    const seen = /* @__PURE__ */ new Set();
    for (const paragraph of paragraphs) {
      const key = normalizeLine(paragraph);
      if (seen.has(key)) {
        redundant.push(paragraph);
        continue;
      }
      seen.add(key);
      if (/\b(please|ensure|make sure|important|must|definitely)\b/gi.test(paragraph) && paragraph.length > 220) {
        redundant.push(paragraph);
      }
    }
    return unique(redundant).slice(0, 5);
  }
  function buildSuggestions(text, breakdownTotal, repeatedInstructions, redundantSections) {
    const suggestions = [];
    const lines = uniqueNonEmptyLines(text);
    const codeHeavy = text.includes("```");
    const quoteHeavy = /^>\s/m.test(text);
    const largePaste = breakdownTotal >= 1600 || text.length > 6500;
    if (repeatedInstructions.length) {
      const duplicateTokens = repeatedInstructions.reduce((acc, line) => acc + estimateSectionTokens(line, "instruction"), 0);
      suggestions.push({
        id: "repeat",
        title: "Remove repeated instructions",
        description: "The prompt repeats guidance that the model only needs once.",
        estimatedSavings: Math.max(40, duplicateTokens),
        severity: "medium",
        applyVariant: "shorter"
      });
    }
    if (redundantSections.length) {
      suggestions.push({
        id: "redundant",
        title: "Trim redundant framing",
        description: "Long preambles and repeated reassurance rarely improve output quality.",
        estimatedSavings: Math.round(breakdownTotal * 0.12),
        severity: "medium",
        applyVariant: "balanced"
      });
    }
    if (largePaste) {
      suggestions.push({
        id: "large-paste",
        title: "Summarize or chunk long context",
        description: "The prompt looks like a large paste. Summarize first or send only the relevant excerpt.",
        estimatedSavings: Math.round(breakdownTotal * 0.28),
        severity: "high",
        applyVariant: "shorter"
      });
    }
    if (codeHeavy) {
      suggestions.push({
        id: "code-heavy",
        title: "Share only the diff or relevant file sections",
        description: "Large code blocks are token expensive. Ask for the exact function, stack trace, or patch instead.",
        estimatedSavings: Math.round(breakdownTotal * 0.18),
        severity: "medium",
        applyVariant: "balanced"
      });
    }
    if (quoteHeavy) {
      suggestions.push({
        id: "quotes",
        title: "Trim quoted context",
        description: "Quoted text often duplicates what the current thread already contains.",
        estimatedSavings: Math.round(breakdownTotal * 0.14),
        severity: "low",
        applyVariant: "shorter"
      });
    }
    if (lines.length >= 9) {
      suggestions.push({
        id: "phase",
        title: "Ask in phases",
        description: "Split the request into stages so the model only loads the context it needs now.",
        estimatedSavings: Math.round(breakdownTotal * 0.2),
        severity: "medium",
        applyVariant: "balanced"
      });
    }
    return suggestions.slice(0, 6);
  }
  function buildVariants(text) {
    return {
      shorter: buildVariant(text, "shorter"),
      balanced: buildVariant(text, "balanced"),
      maxDetail: buildVariant(text, "maxDetail")
    };
  }
  function analyzePrompt(text) {
    const breakdown = estimateTokenBreakdown(text);
    const repeatedInstructions = findRepeatedInstructions(text);
    const redundantSections = findRedundantSections(text);
    const suggestions = buildSuggestions(text, breakdown.total, repeatedInstructions, redundantSections);
    const variants = buildVariants(text);
    const variantSavings = Object.values(variants).map((variant) => Math.max(0, breakdown.total - estimateTokenBreakdown(variant).total));
    const bestSavings = Math.max(0, ...variantSavings, ...suggestions.map((item) => item.estimatedSavings));
    return {
      inputTokens: breakdown.total,
      outputTokensEstimate: breakdown.estimatedOutputTokens,
      totalTokens: breakdown.total + breakdown.estimatedOutputTokens,
      sections: breakdown.sections,
      suggestions,
      variants,
      repeatedInstructions,
      redundantSections,
      largePaste: breakdown.total >= 1600 || text.length > 6500,
      compressionScore: clamp(Math.round(bestSavings / Math.max(1, breakdown.total) * 100), 0, 100)
    };
  }

  // src/lib/format.ts
  function formatTokens(tokens) {
    if (tokens === void 0 || Number.isNaN(tokens)) return "\u2014";
    if (tokens >= 1e6) return `${round(tokens / 1e6, 2)}M`;
    if (tokens >= 1e3) return `${round(tokens / 1e3, 1)}K`;
    return `${Math.round(tokens)}`;
  }
  function formatPercent(value) {
    if (value === void 0 || Number.isNaN(value)) return "\u2014";
    return `${round(clamp(value, 0, 100), value > 10 ? 0 : 1)}%`;
  }
  function formatDateTime(timestamp) {
    if (!timestamp) return "Unknown";
    return new Intl.DateTimeFormat(void 0, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(timestamp));
  }
  function formatDuration(ms) {
    if (ms === void 0) return "\u2014";
    if (ms <= 0) return "now";
    const totalSeconds = Math.floor(ms / 1e3);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds % 86400 / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  // src/lib/resetPredictor.ts
  function parseAnchor(anchor = "00:00") {
    const [hours, minutes] = anchor.split(":").map((value) => Number.parseInt(value, 10));
    return {
      hours: Number.isFinite(hours) ? hours : 0,
      minutes: Number.isFinite(minutes) ? minutes : 0
    };
  }
  function getCurrentWindowBounds(rule, now = Date.now()) {
    const date = new Date(now);
    switch (rule.kind) {
      case "rolling": {
        const intervalMs = (rule.intervalMinutes ?? 180) * 6e4;
        return { start: now - intervalMs, end: now + intervalMs };
      }
      case "hourly": {
        const intervalMinutes = rule.intervalMinutes ?? 60;
        const current = new Date(now);
        const minutes = current.getMinutes();
        const snappedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
        current.setMinutes(snappedMinutes, 0, 0);
        const start = current.getTime();
        return { start, end: start + intervalMinutes * 6e4 };
      }
      case "daily": {
        const { hours, minutes } = parseAnchor(rule.anchorLocalTime);
        const start = new Date(now);
        start.setHours(hours, minutes, 0, 0);
        if (start.getTime() > now) {
          start.setDate(start.getDate() - 1);
        }
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { start: start.getTime(), end: end.getTime() };
      }
      case "weekly": {
        const targetDay = rule.dayOfWeek ?? 1;
        const start = new Date(now);
        const { hours, minutes } = parseAnchor(rule.anchorLocalTime);
        start.setHours(hours, minutes, 0, 0);
        const currentDay = start.getDay();
        const delta = (currentDay - targetDay + 7) % 7;
        start.setDate(start.getDate() - delta);
        if (start.getTime() > now) {
          start.setDate(start.getDate() - 7);
        }
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return { start: start.getTime(), end: end.getTime() };
      }
      case "custom": {
        const intervalMs = (rule.intervalMinutes ?? 1440) * 6e4;
        return { start: now - intervalMs, end: now + intervalMs };
      }
      case "unknown":
      default:
        return {};
    }
  }
  function predictReset(options) {
    const now = options.now ?? Date.now();
    const explicitResetAt = options.explicitResetAt;
    const rule = options.rule ?? { kind: "unknown", inferred: true };
    if (explicitResetAt && explicitResetAt > now) {
      return {
        resetAt: explicitResetAt,
        remainingMs: explicitResetAt - now,
        windowEnd: explicitResetAt,
        localLabel: formatDateTime(explicitResetAt),
        kind: rule.kind,
        confidence: "exact",
        explanation: "Detected from the site UI or a rate-limit message."
      };
    }
    switch (rule.kind) {
      case "rolling": {
        const intervalMs = (rule.intervalMinutes ?? 180) * 6e4;
        const recentEvents = [...options.events ?? []].filter((event) => event.timestamp >= now - intervalMs).sort((a, b) => a.timestamp - b.timestamp);
        const oldest = recentEvents[0]?.timestamp ?? now;
        const resetAt = oldest + intervalMs;
        return {
          resetAt,
          remainingMs: Math.max(0, resetAt - now),
          windowStart: oldest,
          windowEnd: resetAt,
          localLabel: formatDateTime(resetAt),
          kind: "rolling",
          confidence: rule.inferred ? "inferred" : "estimated",
          explanation: recentEvents.length ? "Estimated from the oldest observed event inside the rolling usage window." : "Estimated from the configured rolling window because no exact reset signal was available."
        };
      }
      case "hourly":
      case "daily":
      case "weekly":
      case "custom": {
        const { start, end } = getCurrentWindowBounds(rule, now);
        return {
          resetAt: end,
          remainingMs: end ? Math.max(0, end - now) : void 0,
          windowStart: start,
          windowEnd: end,
          localLabel: end ? formatDateTime(end) : "Unknown",
          kind: rule.kind,
          confidence: rule.inferred ? "inferred" : "estimated",
          explanation: "Estimated from the configured reset schedule."
        };
      }
      case "unknown":
      default:
        return {
          localLabel: "Unknown",
          kind: "unknown",
          confidence: "inferred",
          explanation: "No explicit reset rule or rate-limit signal was detected yet."
        };
    }
  }
  function computeQuotaStatus(options) {
    const now = options.now ?? Date.now();
    const rule = options.rule ?? { kind: "unknown", inferred: true };
    const prediction = predictReset({
      events: options.events,
      rule,
      explicitResetAt: options.explicitResetAt,
      now
    });
    const currentWindowEvents = (() => {
      if (rule.kind === "rolling") {
        const intervalMs = (rule.intervalMinutes ?? 180) * 6e4;
        return options.events.filter((event) => event.timestamp >= now - intervalMs);
      }
      if (prediction.windowStart !== void 0) {
        return options.events.filter((event) => event.timestamp >= prediction.windowStart);
      }
      return options.events;
    })();
    const usedTokens = sum(currentWindowEvents.map((event) => event.totalTokens));
    const remainingTokens = options.tokenBudget !== void 0 ? Math.max(0, options.tokenBudget - usedTokens) : options.remainingTokensHint;
    const percentUsed = options.tokenBudget !== void 0 ? clamp(usedTokens / Math.max(1, options.tokenBudget) * 100, 0, 100) : options.percentUsedHint;
    let status = options.statusHint ?? "unknown";
    if (status === "unknown") {
      if (currentWindowEvents.some((event) => event.status === "rate_limited")) {
        status = "limited";
      } else if (percentUsed !== void 0 && percentUsed >= 100) {
        status = "limited";
      } else if (percentUsed !== void 0 && percentUsed >= 85) {
        status = "warning";
      } else if (currentWindowEvents.length > 0) {
        status = "ok";
      }
    }
    const accuracy = options.explicitResetAt ? "exact" : prediction.confidence;
    return {
      usedTokens,
      remainingTokens,
      percentUsed,
      status,
      quotaTier: options.quotaTier,
      resetRule: rule,
      accuracy,
      explicitResetAt: options.explicitResetAt,
      nextReset: prediction
    };
  }

  // src/lib/runtime.ts
  async function sendRuntimeMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  // src/content/overlay.ts
  var DEFAULT_CONTEXT_WINDOWS = {
    chatgpt: 128e3,
    claude: 2e5,
    gemini: 1e6,
    perplexity: 2e5,
    grok: 128e3,
    generic: 128e3
  };
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }
  function lastByRole(messages, role) {
    return [...messages].reverse().find((message) => message.role === role);
  }
  function tokensForMessage(message) {
    return message ? estimateTokenBreakdown(message.text).total : void 0;
  }
  function formatShortTime(timestamp) {
    return timestamp ? formatDateTime(timestamp) : "No captures yet";
  }
  function formatInteger(value) {
    return new Intl.NumberFormat(void 0, {
      maximumFractionDigits: 0
    }).format(Math.max(0, Math.round(value || 0)));
  }
  function estimatedCreditWeight(site, model) {
    const label = `${site} ${model ?? ""}`.toLowerCase();
    if (label.includes("claude") || label.includes("sonnet") || label.includes("opus") || label.includes("haiku")) return 5;
    if (label.includes("gpt") || label.includes("openai")) return 4;
    if (label.includes("gemini")) return 4;
    return 3;
  }
  function activeLengthTokens(state) {
    return (state.conversation?.totalTokens ?? 0) + (state.currentInput?.trim() ? state.analysis.inputTokens : 0);
  }
  function activeCreditEstimate(state) {
    const outputWeight = estimatedCreditWeight(state.site, state.model);
    const draftInput = state.currentInput?.trim() ? state.analysis.inputTokens : 0;
    return (state.conversation?.promptTokens ?? 0) + draftInput + (state.conversation?.outputTokens ?? 0) * outputWeight;
  }
  function buildOverlaySummary(state) {
    const lastUser = lastByRole(state.messages ?? [], "user");
    const lastAssistant = lastByRole(state.messages ?? [], "assistant");
    const lastEvent = state.lastEvent;
    return [
      "Yor Token Usage",
      `${SITE_LABELS[state.site] ?? state.site} - ${state.model || "Unknown model"}`,
      `Draft input: ${formatTokens(state.analysis.inputTokens)}`,
      `Draft output estimate: ${formatTokens(state.analysis.outputTokensEstimate)}`,
      `Thread total: ${formatTokens(state.conversation.totalTokens)}`,
      `Thread messages: ${state.messages?.length ?? 0}`,
      `Current window used: ${formatTokens(state.quota.usedTokens)}`,
      `Quota: ${state.quota.remainingTokens !== void 0 ? `${formatTokens(state.quota.remainingTokens)} remaining` : state.quota.percentUsed !== void 0 ? formatPercent(state.quota.percentUsed) : "budget not set"}`,
      `Reset: ${state.quota.nextReset?.localLabel ?? "unknown"}`,
      `Today: ${formatTokens(state.summary?.tokensToday ?? 0)}`,
      `7-day total: ${formatTokens(state.summary?.tokensThisWeek ?? 0)}`,
      `Last captured exchange: ${lastEvent ? `${formatTokens(lastEvent.totalTokens)} on ${formatShortTime(lastEvent.timestamp)}` : "none"}`,
      `Last user message: ${lastUser ? `${formatTokens(tokensForMessage(lastUser))} - ${truncate(lastUser.text, 120)}` : "not detected"}`,
      `Last assistant message: ${lastAssistant ? `${formatTokens(tokensForMessage(lastAssistant))} - ${truncate(lastAssistant.text, 120)}` : "not detected"}`
    ].join("\n");
  }
  var styles = `
:host { all: initial; }
* { box-sizing: border-box; }
button:focus-visible {
  outline: 2px solid rgba(143, 220, 196, 0.76);
  outline-offset: 2px;
}
.yor-root {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483647;
  width: 430px;
  max-width: calc(100vw - 24px);
  color: #f4f1ea;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  line-height: 1.35;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --dur-fast: 150ms;
  --dur-med: 220ms;
}
.yor-page-meter {
  position: fixed;
  top: 96px;
  left: 88px;
  max-width: min(760px, calc(100vw - 130px));
  border: 0;
  background: transparent;
  color: rgba(244,241,234,0.74);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 1.25;
  padding: 0;
  text-align: left;
  text-shadow: 0 1px 2px rgba(0,0,0,0.55);
  animation: yor-fade-in var(--dur-med) var(--ease-out) both;
  transition: opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard);
}
.yor-page-meter:hover { opacity: 0.92; transform: translateY(-1px); }
.yor-page-meter strong { color: #2f9cf5; font-weight: 760; }
.yor-page-meter span + span { margin-left: 8px; }
.yor-card {
  border-radius: 8px;
  overflow: hidden;
  background: rgba(15, 15, 17, 0.97);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(244, 241, 234, 0.16);
  box-shadow: 0 22px 60px rgba(0,0,0,0.52);
  animation: yor-rise-in var(--dur-med) var(--ease-out) both;
}
.yor-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(244,241,234,0.075), rgba(244,241,234,0.025));
  border-bottom: 1px solid rgba(244,241,234,0.10);
}
.yor-title { display:grid; gap:7px; min-width:0; }
.yor-brand { display:flex; align-items:center; gap:8px; min-width:0; }
.yor-brand strong { font-size: 14px; letter-spacing: 0; color:#fffaf2; white-space:nowrap; }
.yor-status {
  border: 1px solid rgba(127, 209, 185, 0.34);
  border-radius: 999px;
  color: #9fe5cf;
  font-size: 10px;
  font-weight: 720;
  padding: 2px 7px;
  white-space: nowrap;
}
.yor-meta { font-size: 11px; color: rgba(244,241,234,0.68); overflow-wrap: anywhere; }
.yor-quickline {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap: 4px 9px;
  color: rgba(244,241,234,0.72);
  font-size: 12px;
}
.yor-quickline strong { color:#fffaf2; font-size: 13px; }
.yor-quickline span { white-space:nowrap; }
.yor-body { padding: 12px; display: grid; gap: 11px; max-height: min(70vh, 650px); overflow-y: auto; overscroll-behavior: contain; }
.yor-body::-webkit-scrollbar { width: 10px; }
.yor-body::-webkit-scrollbar-thumb {
  background: rgba(244,241,234,0.18);
  border: 3px solid rgba(15,15,17,0.97);
  border-radius: 999px;
}
.yor-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.yor-stat { padding: 9px; border-radius: 8px; background: rgba(244,241,234,0.055); border: 1px solid rgba(244,241,234,0.07); display:grid; gap:4px; min-width: 0; }
.yor-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(244,241,234,0.58); }
.yor-stat-value { font-size: 15px; font-weight: 760; overflow-wrap: anywhere; color:#fffaf2; }
.yor-stat-note { font-size: 10px; color: rgba(244,241,234,0.58); overflow-wrap: anywhere; }
.yor-section { display: grid; gap: 8px; }
.yor-section-head { display:flex; justify-content:space-between; align-items:center; gap:10px; color: rgba(244,241,234,0.64); font-size: 11px; }
.yor-section-head strong { color:#fffaf2; font-size:12px; }
.yor-meter { height: 7px; border-radius: 999px; background: rgba(244,241,234,0.10); overflow: hidden; }
.yor-meter > span { display:block; height:100%; border-radius:inherit; background: linear-gradient(90deg, #7fd1b9, #d5a853 70%, #e06d52); transition: width var(--dur-med) var(--ease-out); }
.yor-rows { display:grid; gap: 6px; }
.yor-row { display:grid; grid-template-columns: 78px minmax(0, 1fr) auto; gap: 8px; align-items:start; padding: 8px; border-radius: 8px; background: rgba(244,241,234,0.045); border: 1px solid rgba(244,241,234,0.06); animation: yor-list-in var(--dur-med) var(--ease-out) both; transition: border-color var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard); }
.yor-row:hover { border-color: rgba(244,241,234,0.12); transform: translateX(1px); }
.yor-row-label { color: rgba(244,241,234,0.58); text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; }
.yor-row-main { min-width:0; color: rgba(244,241,234,0.86); overflow-wrap:anywhere; }
.yor-row-main strong { display:block; color:#fffaf2; margin-bottom: 2px; font-size: 12px; }
.yor-row-value { color:#fffaf2; font-weight:700; white-space:nowrap; }
.yor-list { margin:0; padding:0; display:grid; gap: 6px; list-style:none; color: rgba(244,241,234,0.86); }
.yor-list li { padding: 8px; border-radius: 8px; background: rgba(244,241,234,0.045); border: 1px solid rgba(244,241,234,0.06); animation: yor-list-in var(--dur-med) var(--ease-out) both; }
.yor-actions { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:7px; }
.yor-button {
  border:1px solid rgba(244,241,234,0.13); border-radius:8px; padding:8px 10px; cursor:pointer; color:#fffaf2;
  background: rgba(244,241,234,0.07); font: inherit; font-size:12px; font-weight:650; min-width:0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard);
}
.yor-button.primary { background: #9fe5cf; color: #101112; border:0; }
.yor-button:hover { border-color: rgba(244,241,234,0.22); transform: translateY(-1px); }
.yor-button:active { transform: translateY(0) scale(0.985); }
.yor-button:disabled { cursor: default; opacity: 0.45; }
.yor-icon-button {
  width: 74px;
  flex: 0 0 auto;
}
.yor-hidden { display:none; }
@keyframes yor-rise-in {
  from { opacity: 0; transform: translateY(8px) scale(0.992); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes yor-list-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes yor-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (max-width: 768px) {
  .yor-root { right: 10px; left: 10px; width: auto; bottom: 10px; }
  .yor-page-meter { top: 70px; left: 14px; right: 14px; max-width: none; font-size: 12px; }
  .yor-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .yor-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .yor-row { grid-template-columns: 72px minmax(0, 1fr); }
  .yor-row-value { grid-column: 2; }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
`;
  var OverlayWidget = class {
    container;
    shadow;
    visible = true;
    collapsed = true;
    state;
    callbacks;
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.container = document.createElement("div");
      this.container.className = "yor-token-usage-root";
      this.shadow = this.container.attachShadow({ mode: "open" });
      this.shadow.innerHTML = `<style>${styles}</style>`;
      document.documentElement.appendChild(this.container);
    }
    setVisible(value) {
      this.visible = value;
      this.container.style.display = value ? "" : "none";
    }
    toggleCollapsed() {
      this.collapsed = !this.collapsed;
      this.render(this.state);
    }
    render(state) {
      if (!state) return;
      this.state = state;
      const messages = state.messages ?? [];
      const lastUser = lastByRole(messages, "user");
      const lastAssistant = lastByRole(messages, "assistant");
      const lastUserTokens = tokensForMessage(lastUser);
      const lastAssistantTokens = tokensForMessage(lastAssistant);
      const percent = Number.isFinite(state.quota.percentUsed) ? state.quota.percentUsed : void 0;
      const resetMs = state.quota.nextReset?.remainingMs;
      const suggestions = (state.analysis.suggestions ?? []).slice(0, 3);
      const sections = (state.analysis.sections ?? []).slice(0, 5);
      const hasDraft = Boolean(state.currentInput?.trim()) || state.analysis.inputTokens > 0;
      const statusText = state.quota.status === "limited" ? "Limited" : state.quota.status === "warning" ? "Near limit" : percent === void 0 && state.quota.remainingTokens === void 0 ? "Budget not set" : state.quota.accuracy === "exact" ? "Live" : "Estimated";
      const quotaPrimary = state.quota.remainingTokens !== void 0 ? `${formatTokens(state.quota.remainingTokens)} left` : percent !== void 0 ? formatPercent(percent) : `${formatTokens(state.quota.usedTokens)} used`;
      const quotaNote = state.quota.remainingTokens !== void 0 ? `${formatTokens(state.quota.usedTokens)} used this window` : percent !== void 0 ? `${formatTokens(state.quota.usedTokens)} used this window` : "Set a token budget in settings";
      const quotaBarPercent = percent ?? (state.sitePreferences?.tokenBudget ? clamp(state.quota.usedTokens / Math.max(1, state.sitePreferences.tokenBudget) * 100, 0, 100) : 0);
      const contextWindow = state.contextWindow ?? DEFAULT_CONTEXT_WINDOWS[state.site] ?? DEFAULT_CONTEXT_WINDOWS.generic;
      const contextPercent = contextWindow ? clamp(state.conversation.totalTokens / Math.max(1, contextWindow) * 100, 0, 100) : void 0;
      const lastEvent = state.lastEvent;
      const recentLabel = lastEvent ? `${formatTokens(lastEvent.promptTokens)} in / ${formatTokens(lastEvent.outputTokens)} out` : "No captured exchanges";
      const resetLabel = resetMs !== void 0 ? formatDuration(resetMs) : "Unknown";
      const lengthTokens = activeLengthTokens(state);
      const creditEstimate = activeCreditEstimate(state);
      const contextLabel = contextPercent !== void 0 ? `${formatPercent(contextPercent)} context` : "context unknown";
      this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="yor-root ${this.visible ? "" : "yor-hidden"}">
        <button class="yor-page-meter ${this.collapsed ? "" : "yor-hidden"}" data-action="toggle" title="Open Yor Token Usage details">
          <span>Length*: <strong>${formatInteger(lengthTokens)}</strong> tokens</span>
          <span>| Cost: <strong>${formatInteger(creditEstimate)}</strong> credits</span>
        </button>
        <div class="yor-card ${this.collapsed ? "yor-hidden" : ""}">
          <div class="yor-head">
            <div class="yor-title">
              <div class="yor-brand">
                <strong>Yor Token Usage</strong>
                <span class="yor-status">${escapeHtml(statusText)}</span>
              </div>
              <span class="yor-meta">${escapeHtml(SITE_LABELS[state.site] ?? state.site)} &middot; ${escapeHtml(state.model || "Unknown model")} &middot; ${escapeHtml(contextLabel)}</span>
              <div class="yor-quickline">
                <strong>Length*: ${formatInteger(lengthTokens)} tokens</strong>
                <span>Cost: ${formatInteger(creditEstimate)} credits</span>
              </div>
            </div>
            <button class="yor-button yor-icon-button" data-action="toggle" title="${this.collapsed ? "Open details" : "Hide details"}">${this.collapsed ? "Open" : "Hide"}</button>
          </div>
          <div class="yor-body ${this.collapsed ? "yor-hidden" : ""}">
            <div class="yor-kpis">
              <div class="yor-stat">
                <span class="yor-stat-label">Draft</span>
                <span class="yor-stat-value">${hasDraft ? formatTokens(state.analysis.inputTokens) : "No draft"}</span>
                <span class="yor-stat-note">${hasDraft ? `${formatTokens(state.analysis.outputTokensEstimate)} output est.` : "Composer is empty"}</span>
              </div>
              <div class="yor-stat">
                <span class="yor-stat-label">Window</span>
                <span class="yor-stat-value">${quotaPrimary}</span>
                <span class="yor-stat-note">${escapeHtml(quotaNote)}</span>
              </div>
              <div class="yor-stat">
                <span class="yor-stat-label">Thread</span>
                <span class="yor-stat-value">${formatTokens(state.conversation.totalTokens)}</span>
                <span class="yor-stat-note">${messages.length} messages detected</span>
              </div>
              <div class="yor-stat">
                <span class="yor-stat-label">Reset</span>
                <span class="yor-stat-value">${escapeHtml(resetLabel)}</span>
                <span class="yor-stat-note">${escapeHtml(state.quota.nextReset?.localLabel ?? "Schedule estimate")}</span>
              </div>
            </div>
            <div class="yor-section">
              <div class="yor-section-head"><strong>Quota pressure</strong><span>${percent !== void 0 ? formatPercent(percent) : "No percent"}</span></div>
              <div class="yor-meter"><span style="width: ${Math.min(100, Math.max(quotaBarPercent, quotaBarPercent > 0 ? 4 : 0))}%"></span></div>
              <div class="yor-section-head"><strong>Context pressure</strong><span>${contextPercent !== void 0 ? `${formatPercent(contextPercent)} of ${formatTokens(contextWindow)}` : "Unknown"}</span></div>
              <div class="yor-meter"><span style="width: ${Math.min(100, Math.max(contextPercent ?? 0, contextPercent ? 4 : 0))}%"></span></div>
            </div>
            <div class="yor-section">
              <div class="yor-section-head"><strong>Live conversation</strong><span>${formatTokens(state.conversation.promptTokens)} user / ${formatTokens(state.conversation.outputTokens)} assistant</span></div>
              <div class="yor-rows">
                <div class="yor-row">
                  <span class="yor-row-label">Last user</span>
                  <span class="yor-row-main"><strong>${lastUser ? "Detected" : "Missing"}</strong>${escapeHtml(lastUser ? truncate(lastUser.text, 180) : "No user message found in the visible thread.")}</span>
                  <span class="yor-row-value">${formatTokens(lastUserTokens)}</span>
                </div>
                <div class="yor-row">
                  <span class="yor-row-label">Last AI</span>
                  <span class="yor-row-main"><strong>${lastAssistant ? "Detected" : "Missing"}</strong>${escapeHtml(lastAssistant ? truncate(lastAssistant.text, 180) : "No assistant message found in the visible thread.")}</span>
                  <span class="yor-row-value">${formatTokens(lastAssistantTokens)}</span>
                </div>
                <div class="yor-row">
                  <span class="yor-row-label">Captured</span>
                  <span class="yor-row-main"><strong>${lastEvent ? formatShortTime(lastEvent.timestamp) : "Not yet"}</strong>${escapeHtml(recentLabel)}</span>
                  <span class="yor-row-value">${lastEvent ? formatTokens(lastEvent.totalTokens) : "\u2014"}</span>
                </div>
              </div>
            </div>
            <div class="yor-section">
              <div class="yor-section-head"><strong>Current draft breakdown</strong><span>${hasDraft ? `${sections.length} sections` : "No draft"}</span></div>
              <ul class="yor-list">
                ${hasDraft && sections.length ? sections.map((section) => `<li><strong>${escapeHtml(section.type)}</strong> &middot; ${formatTokens(section.tokens)} &middot; ${escapeHtml(truncate(section.label, 90))}</li>`).join("") : "<li>No draft sections to analyze right now.</li>"}
              </ul>
            </div>
            <div class="yor-section">
              <div class="yor-section-head"><strong>Totals</strong><span>${escapeHtml(state.privacyLabel)}</span></div>
              <div class="yor-rows">
                <div class="yor-row">
                  <span class="yor-row-label">Today</span>
                  <span class="yor-row-main"><strong>${formatTokens(state.summary?.tokensToday ?? 0)} tokens</strong>${state.summary?.promptsToday ?? 0} captured prompts</span>
                  <span class="yor-row-value">${state.summary?.promptsToday ?? 0}</span>
                </div>
                <div class="yor-row">
                  <span class="yor-row-label">7 days</span>
                  <span class="yor-row-main"><strong>${formatTokens(state.summary?.tokensThisWeek ?? 0)} tokens</strong>Across all tracked sites</span>
                  <span class="yor-row-value">${formatTokens(state.summary?.tokensThisWeek ?? 0)}</span>
                </div>
              </div>
            </div>
            <div class="yor-section">
              <div class="yor-section-head"><strong>Token reduction</strong><span>${hasDraft ? `${state.analysis.compressionScore}% potential` : "No draft"}</span></div>
              <ul class="yor-list">
                ${suggestions.length ? suggestions.map((item) => `<li><strong>${escapeHtml(item.title)}</strong> &middot; save ~${formatTokens(item.estimatedSavings)}<br>${escapeHtml(item.description ?? "")}</li>`).join("") : `<li>${hasDraft ? "No high-impact reductions found for this draft." : "No draft to optimize yet."}</li>`}
              </ul>
            </div>
            <div class="yor-actions">
              <button class="yor-button primary" data-action="copy-summary">Copy summary</button>
              <button class="yor-button" data-action="copy-shorter" ${hasDraft ? "" : "disabled"}>Copy shorter</button>
              <button class="yor-button" data-action="replace-prompt" ${hasDraft ? "" : "disabled"}>Replace draft</button>
              <button class="yor-button" data-action="open-dashboard">Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    `;
      this.shadow.querySelector('[data-action="copy-summary"]')?.addEventListener("click", () => this.callbacks.onCopySummary?.(this.state));
      this.shadow.querySelector('[data-action="copy-shorter"]')?.addEventListener("click", () => this.callbacks.onCopyShorter());
      this.shadow.querySelector('[data-action="replace-prompt"]')?.addEventListener("click", () => this.callbacks.onReplacePrompt());
      this.shadow.querySelector('[data-action="open-dashboard"]')?.addEventListener("click", () => this.callbacks.onOpenDashboard?.());
      this.shadow.querySelectorAll('[data-action="toggle"]').forEach((button) => {
        button.addEventListener("click", () => this.toggleCollapsed());
      });
    }
  };

  // src/content/index.ts
  var adapter = getAdapterForCurrentSite();
  if (adapter) {
    void init();
  }
  async function init() {
    const initialSnapshot = await sendRuntimeMessage({
      type: "get-snapshot",
      activeUrl: window.location.href
    }).catch(() => void 0);
    let stateCache = initialSnapshot?.state;
    let snapshotCache = initialSnapshot;
    let preferences = initialSnapshot?.state.preferences ?? DEFAULT_PREFERENCES;
    let overlayEnabled = preferences.showOverlay;
    let lastPromptFingerprint = "";
    let latestOverlayState;
    let pendingPrompt;
    const overlay = new OverlayWidget({
      onCopySummary: async (state) => {
        const targetState = state ?? latestOverlayState;
        if (!targetState) return;
        await navigator.clipboard.writeText(buildOverlaySummary(targetState));
      },
      onCopyShorter: async () => {
        const text = adapter.readComposerText();
        const analysis = analyzePrompt(text);
        await navigator.clipboard.writeText(analysis.variants.shorter || text);
      },
      onReplacePrompt: () => {
        const composer2 = adapter.getComposer();
        if (!composer2) return;
        const text = adapter.readComposerText();
        const analysis = analyzePrompt(text);
        const replacement = analysis.variants.balanced || analysis.variants.shorter;
        if ("value" in composer2) {
          composer2.value = replacement;
        } else {
          composer2.textContent = replacement;
        }
        composer2.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: replacement }));
      },
      onOpenDashboard: () => {
        window.open(chrome.runtime.getURL("dashboard/dashboard.html"), "_blank", "noopener");
      },
      onToggle: () => void 0
    });
    overlay.setVisible(overlayEnabled);
    const renderOverlayState = (session, conversation, messages, snapshot = snapshotCache) => {
      const sitePreferencesForSession = preferences.sites[adapter.site] ?? DEFAULT_PREFERENCES.sites[adapter.site];
      const lastEvent = snapshot?.analytics?.timeline?.find((event) => event.site === adapter.site) ?? snapshot?.analytics?.timeline?.[0];
      latestOverlayState = {
        site: session.site,
        model: session.model,
        currentInput: session.currentInput,
        analysis: session.currentEstimate,
        quota: session.quota,
        conversation,
        messages,
        summary: snapshot?.summary,
        lastEvent,
        sitePreferences: sitePreferencesForSession,
        contextWindow: sitePreferencesForSession?.contextWindow ?? DEFAULT_CONTEXT_WINDOWS[adapter.site] ?? DEFAULT_CONTEXT_WINDOWS.generic,
        privacyLabel: preferences.privacyMode === "local-only" ? "Local" : "Synced prefs"
      };
      overlay.render(latestOverlayState);
    };
    const syncSession = async () => {
      const model = adapter.getModelName() ?? stateCache?.sessions[adapter.site]?.model ?? "generic";
      const input = adapter.readComposerText();
      const analysis = analyzePrompt(input);
      const messages = adapter.collectMessages();
      const conversation = estimateConversation(messages);
      const hints = adapter.getQuotaHints();
      const sitePreferences = preferences.sites[adapter.site] ?? DEFAULT_PREFERENCES.sites[adapter.site];
      if (!sitePreferences?.enabled) {
        overlay.setVisible(false);
        return;
      }
      overlay.setVisible(overlayEnabled);
      const siteEvents = stateCache?.usageEvents.filter((event) => event.site === adapter.site && event.model === model) ?? [];
      const quota = computeQuotaStatus({
        events: siteEvents,
        rule: hints.detectedRule ?? sitePreferences.resetRule,
        tokenBudget: sitePreferences.tokenBudget,
        quotaTier: hints.quotaTier ?? sitePreferences.quotaTierLabel,
        explicitResetAt: hints.resetAt,
        remainingTokensHint: hints.remainingTokens,
        percentUsedHint: hints.percentUsed,
        statusHint: hints.status
      });
      const session = {
        site: adapter.site,
        model,
        threadId: adapter.getThreadId(),
        currentInput: input,
        currentEstimate: analysis,
        currentThread: {
          threadId: adapter.getThreadId(),
          site: adapter.site,
          model,
          messageCount: messages.length,
          promptTokens: conversation.promptTokens,
          outputTokens: conversation.outputTokens,
          totalTokens: conversation.totalTokens,
          lastUpdated: Date.now(),
          contextGrowth: conversation.contextGrowth
        },
        quota,
        lastUpdated: Date.now(),
        lastSeenUrl: window.location.href,
        adapterConfidence: hints.confidence ?? 0.8
      };
      renderOverlayState(session, conversation, messages);
      const response = await sendRuntimeMessage({ type: "capture-session", payload: session }).catch(() => void 0);
      if (response?.snapshot?.state) {
        snapshotCache = response.snapshot;
        stateCache = response.snapshot.state;
        preferences = response.snapshot.state.preferences ?? preferences;
        overlayEnabled = preferences.showOverlay;
        overlay.setVisible(overlayEnabled && preferences.sites[adapter.site]?.enabled !== false);
        renderOverlayState(session, conversation, messages, response.snapshot);
      }
    };
    let syncInFlight = false;
    let syncQueued = false;
    let syncTimer = 0;
    let lastSyncAt = 0;
    const MIN_SYNC_INTERVAL_MS = 1500;
    const MUTATION_SYNC_DELAY_MS = 1200;
    const runScheduledSync = async () => {
      if (syncInFlight) {
        syncQueued = true;
        return;
      }
      const now = Date.now();
      const elapsed = now - lastSyncAt;
      if (lastSyncAt > 0 && elapsed < MIN_SYNC_INTERVAL_MS) {
        scheduleSync(MIN_SYNC_INTERVAL_MS - elapsed);
        return;
      }
      syncInFlight = true;
      try {
        await syncSession();
        lastSyncAt = Date.now();
      } finally {
        syncInFlight = false;
        if (syncQueued) {
          syncQueued = false;
          scheduleSync(MUTATION_SYNC_DELAY_MS);
        }
      }
    };
    const scheduleSync = (delay = MUTATION_SYNC_DELAY_MS) => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        void runScheduledSync();
      }, delay);
    };
    const debouncedSync = () => scheduleSync(MUTATION_SYNC_DELAY_MS);
    const registerPendingPrompt = () => {
      if (preferences.sites[adapter.site]?.enabled === false) return;
      const prompt = adapter.readComposerText();
      if (!prompt.trim()) return;
      const fingerprint = `${prompt}:${adapter.getThreadId()}`;
      if (fingerprint === lastPromptFingerprint) return;
      lastPromptFingerprint = fingerprint;
      const analysis = analyzePrompt(prompt);
      const messages = adapter.collectMessages();
      pendingPrompt = {
        id: uid("usage"),
        prompt,
        analysis,
        model: adapter.getModelName() ?? "generic",
        threadId: adapter.getThreadId(),
        assistantCount: messages.filter((message) => message.role === "assistant").length,
        startedAt: Date.now()
      };
    };
    const finalizePendingPrompt = debounce(async () => {
      if (!pendingPrompt) return;
      const messages = adapter.collectMessages();
      const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.text.length > 8);
      const hints = adapter.getQuotaHints();
      if (hints.status === "limited") {
        const rateLimitedEvent = {
          id: pendingPrompt.id,
          site: adapter.site,
          model: pendingPrompt.model,
          threadId: pendingPrompt.threadId,
          timestamp: Date.now(),
          promptTokens: pendingPrompt.analysis.inputTokens,
          outputTokens: 0,
          totalTokens: pendingPrompt.analysis.inputTokens,
          promptChars: pendingPrompt.prompt.length,
          outputChars: 0,
          status: "rate_limited",
          accuracy: hints.resetAt ? "exact" : "inferred",
          promptPreview: truncate(pendingPrompt.prompt, 140),
          optimizerSavings: Math.round(pendingPrompt.analysis.compressionScore / 100 * pendingPrompt.analysis.inputTokens),
          rateLimitMessage: hints.rateLimitMessage,
          resetAt: hints.resetAt
        };
        const response = await sendRuntimeMessage({ type: "commit-usage-event", payload: rateLimitedEvent }).catch(() => void 0);
        if (response?.snapshot?.state) {
          snapshotCache = response.snapshot;
          stateCache = response.snapshot.state;
          preferences = response.snapshot.state.preferences ?? preferences;
        }
        pendingPrompt = void 0;
        return;
      }
      if (!latestAssistant) return;
      const afterAssistantCount = messages.filter((message) => message.role === "assistant").length;
      if (afterAssistantCount <= pendingPrompt.assistantCount) return;
      const assistantAnalysis = analyzePrompt(latestAssistant.text);
      const event = {
        id: pendingPrompt.id,
        site: adapter.site,
        model: pendingPrompt.model,
        threadId: pendingPrompt.threadId,
        timestamp: Date.now(),
        promptTokens: pendingPrompt.analysis.inputTokens,
        outputTokens: assistantAnalysis.inputTokens,
        totalTokens: pendingPrompt.analysis.inputTokens + assistantAnalysis.inputTokens,
        promptChars: pendingPrompt.prompt.length,
        outputChars: latestAssistant.text.length,
        status: "completed",
        accuracy: hints.resetAt ? "exact" : "estimated",
        promptPreview: truncate(pendingPrompt.prompt, 140),
        optimizerSavings: Math.round(pendingPrompt.analysis.compressionScore / 100 * pendingPrompt.analysis.inputTokens),
        rateLimitMessage: hints.rateLimitMessage,
        resetAt: hints.resetAt
      };
      const response = await sendRuntimeMessage({ type: "commit-usage-event", payload: event }).catch(() => void 0);
      if (response?.snapshot?.state) {
        snapshotCache = response.snapshot;
        stateCache = response.snapshot.state;
        preferences = response.snapshot.state.preferences ?? preferences;
      }
      pendingPrompt = void 0;
      await syncSession();
    }, 1600);
    let boundComposer;
    let boundSendButton;
    const isComposerEvent = (event) => {
      const composer = adapter.getComposer();
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const target = event.target;
      return Boolean(composer && (target === composer || composer.contains?.(target) || path.includes(composer)));
    };
    const isSendControlEvent = (event) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const sendButton = adapter.getSendButton();
      if (sendButton && (event.target === sendButton || path.includes(sendButton))) return true;
      const target = event.target;
      const control = target?.closest?.('button, [role="button"], input[type="submit"]');
      if (!control) return false;
      const label = `${control.getAttribute("aria-label") ?? ""} ${control.getAttribute("title") ?? ""} ${control.textContent ?? ""}`;
      return control.type === "submit" || /\b(send|submit)\b/i.test(label);
    };
    const bindLiveControls = () => {
      const composer = adapter.getComposer();
      if (composer && composer !== boundComposer) {
        boundComposer = composer;
        composer.addEventListener("input", debouncedSync);
        composer.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            registerPendingPrompt();
          }
        });
      }
      const sendButton = adapter.getSendButton();
      if (sendButton && sendButton !== boundSendButton) {
        boundSendButton = sendButton;
        sendButton.addEventListener("click", registerPendingPrompt);
      }
    };
    bindLiveControls();
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing && isComposerEvent(event)) {
        registerPendingPrompt();
      }
    }, true);
    document.addEventListener("click", (event) => {
      if (isSendControlEvent(event)) {
        registerPendingPrompt();
      }
    }, true);
    document.addEventListener("submit", () => {
      registerPendingPrompt();
    }, true);
    const observer = new MutationObserver(() => {
      bindLiveControls();
      debouncedSync();
      finalizePendingPrompt();
    });
    observer.observe(adapter.getConversationRoot() ?? document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "toggle-overlay") {
        overlayEnabled = typeof message.value === "boolean" ? message.value : !overlayEnabled;
        overlay.setVisible(overlayEnabled);
        sendResponse({ ok: true, visible: overlayEnabled });
      }
      if (message?.type === "refresh-session") {
        void runScheduledSync();
        sendResponse({ ok: true });
      }
      return true;
    });
    setInterval(() => {
      bindLiveControls();
      scheduleSync(0);
    }, 15e3);
    await runScheduledSync();
  }
})();
