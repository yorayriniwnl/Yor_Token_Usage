import type { AttachmentDescriptor, CapturedMessage, DetectedModelInfo, ObservedQuotaSignal, ProviderSiteAdapter } from "../types/adapters.js";
import { determineSemanticRole, normalizeMessageText, parseQuotaHintsFromText, queryAll, queryFirst } from "./base.js";
import { compactWhitespace } from "../shared/utils.js";

export class GrokAdapter implements ProviderSiteAdapter {
  readonly site = "grok";
  readonly label = "Grok";

  matches(url: URL): boolean {
    return (
      url.hostname === "grok.com" ||
      url.hostname.endsWith(".grok.com") ||
      (url.hostname === "x.com" && url.pathname.startsWith("/i/grok"))
    );
  }

  detectModel(root: ParentNode = document): DetectedModelInfo {
    const el = queryFirst(['button[aria-label*="model" i]', '[data-testid*="grok-model"]'], root);
    const rawName = el?.textContent?.trim() || undefined;
    return {
      rawName,
      label: rawName ? compactWhitespace(rawName) : undefined,
      isKnown: Boolean(rawName)
    };
  }

  findComposer(root: ParentNode = document): HTMLElement | null {
    return queryFirst(
      [
        'textarea[placeholder*="Ask Grok" i]',
        'div[contenteditable="true"][aria-label*="Grok" i]',
        'textarea',
        'div[contenteditable="true"]'
      ],
      root
    );
  }

  readComposerText(composer: HTMLElement): string {
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      return composer.value;
    }
    return composer.innerText || composer.textContent || "";
  }

  findSendControl(root: ParentNode = document): HTMLElement | null {
    return queryFirst(
      [
        'button[aria-label="Grok something" i]',
        'button[aria-label="Send" i]',
        'button[data-testid*="send"]'
      ],
      root
    );
  }

  findStopControl(root: ParentNode = document): HTMLElement | null {
    return queryFirst(['button[aria-label="Stop" i]'], root);
  }

  collectVisibleMessages(root: ParentNode = document): CapturedMessage[] {
    const turns = queryAll(
      [
        '[data-testid*="grok-message"]',
        '[data-testid*="conversation-turn"]',
        '.message-bubble'
      ],
      root
    );

    const messages: CapturedMessage[] = [];
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

  getConversationId(url: URL, _root?: ParentNode): string {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length > 0 ? `grok:${parts[parts.length - 1]}` : "grok:new";
  }

  getQuotaSignals(root: ParentNode = document): ObservedQuotaSignal | null {
    const alert = queryFirst(['[role="alert"]', '.rate-limit-warning'], root);
    if (!alert || !alert.textContent) return null;
    return parseQuotaHintsFromText(alert.textContent);
  }

  getAttachmentDescriptors(root: ParentNode = document): AttachmentDescriptor[] {
    const items = queryAll(['[data-testid*="attachment"]'], root);
    return items.map((item, idx) => ({
      name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
      tokenProvenance: "unknown"
    }));
  }
}
