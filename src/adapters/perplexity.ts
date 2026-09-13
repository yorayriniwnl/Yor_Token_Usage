import type { AttachmentDescriptor, CapturedMessage, DetectedModelInfo, ObservedQuotaSignal, ProviderSiteAdapter } from "../types/adapters.js";
import { determineSemanticRole, normalizeMessageText, parseQuotaHintsFromText, queryAll, queryFirst } from "./base.js";
import { compactWhitespace } from "../shared/utils.js";

export class PerplexityAdapter implements ProviderSiteAdapter {
  readonly site = "perplexity";
  readonly label = "Perplexity";

  matches(url: URL): boolean {
    return url.hostname === "perplexity.ai" || url.hostname.endsWith(".perplexity.ai");
  }

  detectModel(root: ParentNode = document): DetectedModelInfo {
    const el = queryFirst(
      [
        'button[aria-label*="model" i]',
        '[data-testid*="model"]',
        '.model-badge'
      ],
      root
    );
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
        'textarea[placeholder*="Ask anything" i]',
        'textarea[placeholder*="Ask follow-up" i]',
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
        'button[aria-label="Submit" i]',
        'button[aria-label="Send" i]',
        'button[type="submit"]'
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
        '.query-wrapper',
        '.answer-wrapper',
        '[data-testid*="thread-item"]',
        '.conversation-turn'
      ],
      root
    );

    const messages: CapturedMessage[] = [];
    turns.forEach((turn, index) => {
      let role: "user" | "assistant" | "unknown" = "unknown";
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

  getConversationId(url: URL, _root?: ParentNode): string {
    const parts = url.pathname.split("/").filter(Boolean);
    const searchIndex = parts.indexOf("search");
    if (searchIndex !== -1 && parts[searchIndex + 1]) {
      return `perplexity:${parts[searchIndex + 1]}`;
    }
    return parts.length > 0 ? `perplexity:${parts[parts.length - 1]}` : "perplexity:new";
  }

  getQuotaSignals(root: ParentNode = document): ObservedQuotaSignal | null {
    const alert = queryFirst(['[role="alert"]', '.pro-usage-alert'], root);
    if (!alert || !alert.textContent) return null;
    return parseQuotaHintsFromText(alert.textContent);
  }

  getAttachmentDescriptors(root: ParentNode = document): AttachmentDescriptor[] {
    const items = queryAll(['[data-testid*="file-upload"]', '.attachment-pill'], root);
    return items.map((item, idx) => ({
      name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
      tokenProvenance: "unknown"
    }));
  }
}
