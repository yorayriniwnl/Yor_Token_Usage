import type { AttachmentDescriptor } from "../types/adapters.js";
import type { SectionTokenEstimate } from "../types/tokens.js";
import { humanFileSize } from "../shared/utils.js";

/**
 * Redesigned attachment estimation:
 * NEVER uses raw bytes/4.
 * If extracted text is available (e.g. text/code file snippet), estimates from text.
 * If provider exposes page count (e.g. PDF), uses provider-calibrated vision token approximation (~250-1600 tokens/page).
 * If image dimensions exist, calculates vision tiles where formula is known (e.g. 85 tokens base + 170 per tile for OpenAI/Claude).
 * Otherwise marks token contribution as UNKNOWN and never invents precision.
 */
export function processAttachmentDescriptor(attachment: AttachmentDescriptor): {
  tokens: number | null;
  provenance: "calibrated_estimate" | "rough_estimate" | "unknown";
  label: string;
} {
  const sizeText = attachment.sizeBytes ? ` • ${humanFileSize(attachment.sizeBytes)}` : "";
  const pageText = attachment.pages ? ` • ${attachment.pages} pages` : "";
  const label = `[Attachment] ${attachment.name}${sizeText}${pageText}`;

  // If extracted text length is known
  if (attachment.extractedTextLength && attachment.extractedTextLength > 0) {
    return {
      tokens: Math.ceil(attachment.extractedTextLength / 4),
      provenance: "calibrated_estimate",
      label
    };
  }

  // If page count is known (e.g. PDF in Claude/Gemini)
  if (attachment.pages && attachment.pages > 0) {
    // Calibrated vision/document model: ~750 tokens per typical document page
    return {
      tokens: attachment.pages * 750,
      provenance: "rough_estimate",
      label: `${label} (~${attachment.pages * 750} estimated vision/doc tokens)`
    };
  }

  // If image dimensions are known
  if (attachment.dimensions && attachment.dimensions.width > 0 && attachment.dimensions.height > 0) {
    // OpenAI high-res tile formula: 85 base + 170 per 512x512 tile
    const tilesX = Math.ceil(attachment.dimensions.width / 512);
    const tilesY = Math.ceil(attachment.dimensions.height / 512);
    const imageTokens = 85 + tilesX * tilesY * 170;
    return {
      tokens: imageTokens,
      provenance: "calibrated_estimate",
      label: `${label} (${imageTokens} vision tiles)`
    };
  }

  // Pure binary file, PDF without pages, video, audio without provider token indicator:
  // TRUTHFULLY UNKNOWN! Never convert raw bytes to tokens with bytes / 4!
  return {
    tokens: null,
    provenance: "unknown",
    label: `${label} (Token contribution unknown)`
  };
}

export function describeAttachmentsToSections(attachments: AttachmentDescriptor[]): SectionTokenEstimate[] {
  return attachments.map((att) => {
    const processed = processAttachmentDescriptor(att);
    return {
      label: processed.label,
      type: "attachment",
      tokens: processed.tokens ?? 0,
      start: 0,
      end: processed.label.length,
      confidenceTier: processed.tokens === null ? "Unknown" : processed.provenance === "calibrated_estimate" ? "Moderate confidence" : "Rough estimate"
    };
  });
}
