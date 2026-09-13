import type { AttachmentDescriptor, CapturedMessage, DetectedModelInfo, ObservedQuotaSignal, ProviderSiteAdapter } from "../types/adapters.js";
import { determineSemanticRole, normalizeMessageText, parseQuotaHintsFromText, queryAll, queryFirst } from "./base.js";
import { compactWhitespace } from "../shared/utils.js";

export class ClaudeAdapter implements ProviderSiteAdapter {
  readonly site = "claude";
  readonly label = "Claude";

  matches(url: URL): boolean {
    return url.hostname === "claude.ai" || url.hostname.endsWith(".claude.ai");
  }

  detectModel(root: ParentNode = document): DetectedModelInfo {
    const el = queryFirst(
      [
        '[data-testid="model-selector"]',
        'button:has([data-testid="model-selector"])',
        'header button:has-text("Claude")',
        'header button'
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
        '.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"][aria-label*="Message"]',
        'div[contenteditable="true"]',
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
        'button[aria-label="Send"]',
        'button[aria-label="Send Message"]',
        'button[aria-label="Send message"]',
        'form button:has-text("Send")'
      ],
      root
    );
  }

  findStopControl(root: ParentNode = document): HTMLElement | null {
    return queryFirst(
      [
        'button[aria-label="Stop response"]',
        'button[aria-label="Stop generating"]',
        'button:has-text("Stop")'
      ],
      root
    );
  }

  collectVisibleMessages(root: ParentNode = document): CapturedMessage[] {
    const turns = queryAll(
      [
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
        '[role="feed"] article',
        'article[aria-label*="Message"]',
        '.font-claude-message',
        '.font-user-message'
      ],
      root
    );

    const messages: CapturedMessage[] = [];
    const roleCounts = new Map<string, number>();

    turns.forEach((turn, index) => {
      // Check testid or semantic heading first
      let role: "user" | "assistant" | "unknown" = "unknown";
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

        const id =
          turn.getAttribute("data-message-id") ||
          turn.getAttribute("id") ||
          `${role}:${count}:${text.slice(0, 120)}`;

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

  getConversationId(url: URL, _root?: ParentNode): string {
    const parts = url.pathname.split("/").filter(Boolean);
    const chatIndex = parts.indexOf("chat");
    if (chatIndex !== -1 && parts[chatIndex + 1]) {
      return `claude:${parts[chatIndex + 1]}`;
    }
    return parts.length > 0 ? `claude:${parts[parts.length - 1]}` : "claude:new";
  }

  getQuotaSignals(root: ParentNode = document): ObservedQuotaSignal | null {
    // Check alert banner or footer status line
    const alerts = queryAll(['[role="alert"]', 'footer', '.text-danger', '[data-testid*="quota"]'], root);
    for (const el of alerts) {
      const text = el.textContent?.trim();
      if (text && /(?:resets?|messages left|limit|try again)/i.test(text)) {
        return parseQuotaHintsFromText(text);
      }
    }
    return null;
  }

  getAttachmentDescriptors(root: ParentNode = document): AttachmentDescriptor[] {
    const items = queryAll(['[data-testid*="attachment"]', '[data-testid*="file-pill"]'], root);
    return items.map((item, idx) => ({
      name: item.getAttribute("aria-label") || item.textContent?.trim() || `Attachment ${idx + 1}`,
      tokenProvenance: "unknown"
    }));
  }
}
