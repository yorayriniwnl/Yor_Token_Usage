export async function writeTextToClipboard(text: string): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the synchronous user-gesture copy path.
  }

  if (typeof document === "undefined" || !document.body || typeof document.execCommand !== "function") {
    throw new Error("Unable to copy text to clipboard.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.select();
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }

  if (!copied) throw new Error("Unable to copy text to clipboard.");
}
