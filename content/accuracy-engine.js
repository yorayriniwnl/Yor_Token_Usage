(function installYorAccuracyEngine(global) {
  "use strict";

  const URL_PATTERN = /https?:\/\/\S+/i;
  const MEASUREMENT_SCHEMA_VERSION = 1;
  const MEASUREMENT_LEVEL = "approximation";
  const MEASUREMENT_METHOD = "dom-text-heuristic";
  const DEFAULT_ERROR_MARGIN_PERCENT = 40;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sum(values) {
    return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  }

  function compactWhitespace(input) {
    return String(input ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function humanFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
  }

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
        return Math.ceil(chars / 3.5 + lines * 0.3 + punctuation * 0.04 + longWords * 0.06);
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
      const rawLine = index < lines.length - 1 ? `${line}\n` : line;
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
      if (togglesFence) inCode = !inCode;
    });
    flush(position);
    return sections;
  }

  function describeAttachments(attachments) {
    return attachments.map((attachment, index) => {
      const description = `[Attachment ${index + 1}] ${attachment.name}${attachment.sizeBytes ? ` • ${humanFileSize(attachment.sizeBytes)}` : ""}${attachment.pages ? ` • ${attachment.pages} pages` : ""}`;
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
    const detailBoost = ["step by step", "in detail", "full code", "comprehensive", "thorough", "explain", "with examples"]
      .filter((needle) => normalized.includes(needle)).length;
    const conciseBoost = ["brief", "concise", "short answer", "one paragraph", "one sentence"]
      .filter((needle) => normalized.includes(needle)).length;
    const codeBoost = normalized.includes("```") || normalized.includes("typescript") || normalized.includes("javascript") || normalized.includes("python") ? 0.35 : 0;
    const ratio = clamp(0.75 + detailBoost * 0.22 + questionCount * 0.03 + codeBoost - conciseBoost * 0.18, 0.35, 2.8);
    return Math.max(40, Math.round(inputTokens * ratio + questionCount * 6 + 24));
  }

  function estimateTokenBreakdown(text, attachments = []) {
    const safeText = String(text ?? "");
    const sections = [...segmentText(safeText), ...describeAttachments(Array.isArray(attachments) ? attachments : [])];
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
      estimatedOutputTokens: estimateOutputTokensFromPrompt(safeText, totalInputTokens),
      total: totalInputTokens,
      sections
    };
  }

  function createMeasurement({ provider = "generic", model = "unknown", adapterConfidence = 0.5, source = "visible provider DOM text" } = {}) {
    const safeAdapterConfidence = Number.isFinite(adapterConfidence) ? clamp(adapterConfidence, 0, 1) : 0.5;
    const confidence = Number((0.42 + safeAdapterConfidence * 0.18).toFixed(2));
    return {
      schemaVersion: MEASUREMENT_SCHEMA_VERSION,
      measurementMethod: MEASUREMENT_METHOD,
      measurementLevel: MEASUREMENT_LEVEL,
      confidence,
      errorMarginPercent: DEFAULT_ERROR_MARGIN_PERCENT,
      provider: String(provider || "generic").slice(0, 64),
      model: String(model || "unknown").slice(0, 120),
      tokenizer: "none",
      source: String(source || "visible provider DOM text").slice(0, 160),
      note: "Visible text only; ±40% is calibrated against an OpenAI BPE reference, not provider billing."
    };
  }

  global.YorTokenAccuracy = Object.freeze({
    schemaVersion: MEASUREMENT_SCHEMA_VERSION,
    estimateSectionTokens,
    segmentText,
    estimateOutputTokensFromPrompt,
    estimateTokenBreakdown,
    createMeasurement
  });
})(globalThis);
