import type { AttachmentDescriptor, CapturedMessage, DetectedModelInfo, ObservedQuotaSignal, ProviderSiteAdapter } from "../types/adapters.js";
import { determineSemanticRole, normalizeMessageText, parseQuotaHintsFromText, queryAll, queryFirst } from "./base.js";
import { compactWhitespace } from "../shared/utils.js";

export class GeminiAdapter implements ProviderSiteAdapter {
  readonly site = "gemini";
  readonly label = "Gemini";

  matches(url: URL): boolean {
    return url.hostname === "gemini.google.com" || url.hostname.endsWith(".gemini.google.com");
  }

  detectModel(root: ParentNode = document): DetectedModelInfo {
    const el = queryFirst(
      [
        '[data-test-id="model-picker-btn"]',
        'button[aria-label*="model" i]',
        '.model-select-button'
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
        '.ql-editor[contenteditable="true"]',
        'rich-textarea [contenteditable="true"]',
        'div[contenteditable="true"][aria-label*="prompt" i]',
        'textarea[aria-label*="prompt" i]'
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
        'button[aria-label*="Send message" i]',
        'button.send-button',
        '[data-test-id="send-button"]'
      ],
      root
    );
  }

  findStopControl(root: ParentNode = document): HTMLElement | null {
    return queryFirst(
      [
        'button[aria-label*="Stop response" i]',
        'button[aria-label*="Stop generating" i]',
        '.stop-button'
      ],
      root
    );
  }

  collectVisibleMessages(root: ParentNode = document): CapturedMessage[] {
    const turns = queryAll(
      [
        'user-query',
        'model-response',
        '[data-message-author-role]',
        '.conversation-container .message'
      ],
      root
    );

    const messages: CapturedMessage[] = [];
    turns.forEach((turn, index) => {
      let role: "user" | "assistant" | "unknown" = "unknown";
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

  getConversationId(url: URL, _root?: ParentNode): string {
    const parts = url.pathname.split("/").filter(Boolean);
    const appIndex = parts.indexOf("app");
    if (appIndex !== -1 && parts[appIndex + 1]) {
      return `gemini:${parts[appIndex + 1]}`;
    }
    return parts.length > 0 ? `gemini:${parts[parts.length - 1]}` : "gemini:root";
  }

  getQuotaSignals(root: ParentNode = document): ObservedQuotaSignal | null {
    const banner = queryFirst(['[role="alert"]', '.quota-banner', '.warning-message'], root);
    if (!banner || !banner.textContent) return null;
    return parseQuotaHintsFromText(banner.textContent);
  }

  getAttachmentDescriptors(root: ParentNode = document): AttachmentDescriptor[] {
    const items = queryAll(['[data-test-id*="attachment"]', '.file-preview'], root);
    return items.map((item, idx) => ({
      name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
      tokenProvenance: "unknown"
    }));
  }
}
