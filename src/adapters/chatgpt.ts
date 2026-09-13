import type { AttachmentDescriptor, CapturedMessage, DetectedModelInfo, ObservedQuotaSignal, ProviderSiteAdapter } from "../types/adapters.js";
import { determineSemanticRole, normalizeMessageText, parseQuotaHintsFromText, queryAll, queryFirst } from "./base.js";
import { compactWhitespace } from "../shared/utils.js";

export class ChatGPTAdapter implements ProviderSiteAdapter {
  readonly site = "chatgpt";
  readonly label = "ChatGPT";

  matches(url: URL): boolean {
    return (
      url.hostname === "chatgpt.com" ||
      url.hostname === "chat.openai.com" ||
      url.hostname.endsWith(".chatgpt.com")
    );
  }

  detectModel(root: ParentNode = document): DetectedModelInfo {
    const selector = [
      '[data-testid="model-switcher-dropdown-button"]',
      'button[aria-haspopup="menu"][data-testid*="model"]',
      '[data-testid*="model-selector"]',
      'button:has([data-testid*="model"])'
    ];
    const el = queryFirst(selector, root);
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
        '#prompt-textarea',
        '[data-testid="prompt-textarea"]',
        'form textarea',
        'div[contenteditable="true"][data-placeholder]',
        'textarea[placeholder*="Message"]'
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
        '[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send message"]',
        'form button[type="submit"]',
        'button[data-testid*="send"]'
      ],
      root
    );
  }

  findStopControl(root: ParentNode = document): HTMLElement | null {
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

  collectVisibleMessages(root: ParentNode = document): CapturedMessage[] {
    const turns = queryAll(['[data-message-author-role]', 'article[data-testid*="conversation-turn"]', '[data-testid*="message"]'], root);
    const messages: CapturedMessage[] = [];

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

  getConversationId(url: URL, _root?: ParentNode): string {
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

  getQuotaSignals(root: ParentNode = document): ObservedQuotaSignal | null {
    const alert = queryFirst(
      [
        '[role="alert"]',
        '.alert-error',
        '[data-testid*="limit-banner"]',
        '[data-testid*="quota"]'
      ],
      root
    );
    if (!alert || !alert.textContent) return null;
    return parseQuotaHintsFromText(alert.textContent);
  }

  getAttachmentDescriptors(root: ParentNode = document): AttachmentDescriptor[] {
    const items = queryAll(['[data-testid*="attachment"]', '[data-testid*="file"]'], root);
    return items.map((item, idx) => ({
      name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
      tokenProvenance: "unknown"
    }));
  }
}
