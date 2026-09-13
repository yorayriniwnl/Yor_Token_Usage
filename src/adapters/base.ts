import type { MessageRole, ObservedQuotaSignal } from "../types/adapters.js";
import { compactWhitespace } from "../shared/utils.js";

export function queryFirst<T extends Element = HTMLElement>(selectors: string[], root: ParentNode = document): T | null {
  for (const selector of selectors) {
    try {
      const element = root.querySelector<T>(selector);
      if (element) return element;
    } catch {
      continue;
    }
  }
  return null;
}

export function queryAll<T extends Element = HTMLElement>(selectors: string[], root: ParentNode = document): T[] {
  try {
    const combined = selectors.join(", ");
    return Array.from(root.querySelectorAll<T>(combined));
  } catch {
    const elements: T[] = [];
    for (const selector of selectors) {
      try {
        root.querySelectorAll<T>(selector).forEach((el) => {
          if (!elements.includes(el)) elements.push(el);
        });
      } catch {
        continue;
      }
    }
    return elements;
  }
}

export function parseRelativeReset(text: string): number | undefined {
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
    const parsed = new Date(`${new Date().toDateString()} ${clockMatch[1]}`);
    if (!Number.isNaN(parsed.getTime())) {
      if (parsed.getTime() < Date.now()) parsed.setDate(parsed.getDate() + 1);
      return parsed.getTime();
    }
  }
  const absoluteMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?(?:\s+at)?\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (absoluteMatch) {
    const parsed = new Date(absoluteMatch[1]);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
  }
  return undefined;
}

export function parseQuotaHintsFromText(text: string): ObservedQuotaSignal {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return { source: "unknown" };

  const limited = /(?:reached|exceeded|hit)[^.]*\b(?:limit|quota)\b|too many requests|try again later|(?:limit|quota)\s+(?:reached|exceeded)/i.test(normalized);
  const remainingMatch = normalized.match(/(?<![\d.,])(\d+(?:,\d{3})*)\s+tokens\s+remaining/i);
  const percentMatch = normalized.match(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%\s*(used|remaining)/i);
  const percentage = percentMatch ? Number(percentMatch[1]) : undefined;
  const tierMatch = normalized.match(/\b(plus|pro|advanced|premium|free)\b/i);

  return {
    resetAt: /\bresets?\b|\btry again\b/i.test(normalized) ? parseRelativeReset(normalized) : undefined,
    rateLimitMessage: limited ? normalized.slice(0, 220) : undefined,
    remainingTokens: remainingMatch ? Number.parseInt(remainingMatch[1].replace(/,/g, ""), 10) : undefined,
    percentUsed: percentage !== undefined && percentage <= 100
      ? (percentMatch![2].toLowerCase() === "remaining" ? 100 - percentage : percentage)
      : undefined,
    quotaTier: tierMatch?.[1] ? tierMatch[1][0].toUpperCase() + tierMatch[1].slice(1).toLowerCase() : undefined,
    status: limited ? "limited" : undefined,
    source: "dom_alert",
    rawText: normalized.slice(0, 300)
  };
}

export function normalizeMessageText(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  copy.querySelectorAll('button, [role="toolbar"], time, [role="status"], [aria-hidden="true"], .sr-only').forEach((el) => el.remove());
  const heading = copy.querySelector('h1, h2, h3, [role="heading"]');
  if (heading && /^(You said:|Claude responded:)/i.test(heading.textContent?.trim() ?? "")) {
    heading.remove();
  }
  copy.querySelectorAll("p, div, li, pre, br").forEach((el) => el.append("\n"));
  return compactWhitespace(copy.textContent || "");
}

export function determineSemanticRole(node: Element): MessageRole {
  const attributeNames = ["data-message-author-role", "data-is-author", "data-author", "data-testid", "aria-label", "class"];
  const parts: string[] = [];
  let cursor: Element | null = node;
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

  // Truthful: never guess user vs assistant with index % 2!
  return "unknown";
}
