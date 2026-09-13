import type { SectionTokenEstimate } from "../types/tokens.js";
import { compactWhitespace } from "../shared/utils.js";

const URL_PATTERN = /https?:\/\/\S+/i;

function sectionLabel(text: string, type: string): string {
  const clean = compactWhitespace(text.replace(/```/g, "").replace(/^>+/gm, "").trim());
  const preview = clean.split(" ").slice(0, 4).join(" ");
  return preview ? `${type}: ${preview}` : type;
}

export function estimateSectionTokens(
  text: string,
  type: "prose" | "code" | "instruction" | "quote" | "url" | "attachment" | "unknown"
): number {
  const chars = text.length;
  if (!chars) return 0;
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

export function segmentText(text: string): SectionTokenEstimate[] {
  const normalized = text.replace(/\r/g, "");
  if (!normalized.trim()) return [];
  const lines = normalized.split("\n");
  const sections: SectionTokenEstimate[] = [];
  let position = 0;
  let inCode = false;
  let buffer = "";
  let bufferType: "prose" | "code" | "instruction" | "quote" | "url" | null = null;
  let bufferStart = 0;

  const flush = (endPos: number) => {
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
      end: endPos,
      confidenceTier: "Moderate confidence"
    });
    buffer = "";
    bufferType = null;
    bufferStart = endPos;
  };

  lines.forEach((line, index) => {
    const rawLine = index < lines.length - 1 ? `${line}\n` : line;
    const trimmed = line.trim();
    const togglesFence = /^```/.test(trimmed);
    let nextType: "prose" | "code" | "instruction" | "quote" | "url" = "prose";

    if (inCode || togglesFence) {
      nextType = "code";
    } else if (/^>\s?/.test(trimmed)) {
      nextType = "quote";
    } else if (URL_PATTERN.test(trimmed) && trimmed.replace(/https?:\/\/\S+/g, "").trim().length < 24) {
      nextType = "url";
    } else if (
      /^([-*•]|\d+\.)\s/.test(trimmed) ||
      /^(goal|task|context|constraints?|output|format|tone|steps?)\s*:/i.test(trimmed)
    ) {
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
