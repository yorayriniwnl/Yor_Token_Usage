import type { CapturedMessage } from "../types/adapters.js";

interface SubmissionOptions {
  findComposer: () => HTMLElement | null;
  findSendControl: () => HTMLElement | null;
  readComposerText: (composer: HTMLElement) => string;
  getModel: () => string;
  getThreadId: () => string;
  getVisibleMessages: () => CapturedMessage[];
  onSubmit: (text: string, model: string, threadId: string, messages: CapturedMessage[]) => void;
}

const DUPLICATE_SIGNAL_WINDOW_MS = 600;

/** Observe supported send signals without changing the provider's native behavior. */
export function observeUserSubmissions(root: Document, options: SubmissionOptions): void {
  let lastText: string | null = null;
  let lastThreadId: string | null = null;
  let lastSubmittedAt = 0;

  const capture = () => {
    const composer = options.findComposer();
    if (!composer) return;
    const text = options.readComposerText(composer);
    const trimmed = text.trim();
    if (!trimmed) return;

    const model = options.getModel();
    const threadId = options.getThreadId();
    const now = Date.now();
    if (threadId === lastThreadId && trimmed === lastText && now - lastSubmittedAt <= DUPLICATE_SIGNAL_WINDOW_MS) return;

    lastText = trimmed;
    lastThreadId = threadId;
    lastSubmittedAt = now;
    options.onSubmit(text, model, threadId, options.getVisibleMessages());
  };

  root.addEventListener("input", () => {
    const composer = options.findComposer();
    const currentText = composer ? options.readComposerText(composer).trim() : "";
    if (currentText !== lastText) {
      lastText = null;
      lastThreadId = null;
      lastSubmittedAt = 0;
    }
  }, true);

  root.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Enter" || keyEvent.shiftKey || keyEvent.isComposing || keyEvent.keyCode === 229) return;
    const composer = options.findComposer();
    const target = keyEvent.target;
    if (composer && (target === composer || composer.contains(target as Node | null))) capture();
  }, true);

  root.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement | null;
    const composer = options.findComposer();
    if (form && composer && form.contains(composer)) capture();
  }, true);

  root.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    const sendControl = options.findSendControl();
    if (sendControl && target && (target === sendControl || sendControl.contains(target))) capture();
  }, true);
}
