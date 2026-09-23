export type OptimizationKind = "whitespace" | "exact_deduplication" | "semantic_reduction";

export interface OptimizationSuggestion {
  id: string;
  kind: OptimizationKind;
  title: string;
  description: string;
  originalText: string;
  optimizedText: string;
  estimatedTokensSaved: number;
  requiresUserApproval: boolean;
  preservesSemantics: boolean;
}

export interface PromptOptimizationResult {
  original: string;
  cleanWhitespace: string;
  deduplicated: string;
  semanticVariant?: string;
  suggestions: OptimizationSuggestion[];
}

type FenceMarker = { character: "`" | "~"; length: number };

function getMarkdownContent(line: string): string {
  let content = line;
  while (true) {
    const quotePrefix = /^ {0,3}> ?/.exec(content);
    if (!quotePrefix) return content;
    content = content.slice(quotePrefix[0].length);
  }
}

function getFenceMarker(line: string): FenceMarker | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(getMarkdownContent(line));
  return match ? { character: match[1][0] as "`" | "~", length: match[1].length } : null;
}

function isIndentedCodeLine(line: string): boolean {
  return /^(?: {4}|\t)/.test(getMarkdownContent(line));
}

function closesFence(line: string, marker: FenceMarker): boolean {
  const candidate = getFenceMarker(line);
  if (!candidate || candidate.character !== marker.character || candidate.length < marker.length) return false;
  const content = getMarkdownContent(line);
  const opening = /^ {0,3}(`{3,}|~{3,})/.exec(content);
  return Boolean(opening && content.slice(opening[0].length).trim() === "");
}

function isMarkdownBlankLine(line: string): boolean {
  return getMarkdownContent(line).trim() === "";
}

/** Normalize line endings and collapse excess blank lines outside fenced code. */
export function cleanWhitespace(text: string): string {
  if (!text) return "";
  const parts = text.split(/(\r\n|\r|\n)/);
  const output: string[] = [];
  let fence: FenceMarker | null = null;
  let inIndentedCode = false;
  let blankLines = 0;

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index];
    const lineEnding = parts[index + 1] ?? "";

    if (fence) {
      output.push(line, lineEnding);
      if (closesFence(line, fence)) fence = null;
      continue;
    }

    if (inIndentedCode) {
      if (isMarkdownBlankLine(line) || isIndentedCodeLine(line)) {
        output.push(line, lineEnding);
        continue;
      }
      inIndentedCode = false;
    }

    const marker = getFenceMarker(line);
    if (marker) {
      output.push(line, lineEnding);
      fence = marker;
      blankLines = 0;
      continue;
    }

    if (isIndentedCodeLine(line)) {
      output.push(line, lineEnding);
      inIndentedCode = true;
      blankLines = 0;
      continue;
    }

    if (line.trim() === "") {
      blankLines += 1;
      if (blankLines <= 2) output.push(line, lineEnding ? "\n" : "");
      continue;
    }

    blankLines = 0;
    output.push(line, lineEnding ? "\n" : "");
  }

  return output.join("");
}

/**
 * 2. Exact Deduplication:
 * Removes identical prose lines outside fenced code. Meaning may change, so
 * generated deduplication suggestions always require explicit review.
 */
export function deduplicateLines(text: string): { result: string; removedCount: number } {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const output: string[] = [];
  let removedCount = 0;
  let fence: FenceMarker | null = null;
  let inIndentedCode = false;

  for (const line of lines) {
    if (fence) {
      output.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }

    if (inIndentedCode) {
      if (isMarkdownBlankLine(line) || isIndentedCodeLine(line)) {
        output.push(line);
        continue;
      }
      inIndentedCode = false;
    }

    const marker = getFenceMarker(line);
    if (marker) {
      output.push(line);
      fence = marker;
      seen.clear();
      continue;
    }

    if (isIndentedCodeLine(line)) {
      output.push(line);
      seen.clear();
      inIndentedCode = true;
      continue;
    }

    const trimmed = line.trim();
    // Do not deduplicate empty lines or code block fences or short list bullets
    if (!trimmed || trimmed === "```" || trimmed.length < 5) {
      output.push(line);
      continue;
    }
    if (seen.has(trimmed)) {
      removedCount += 1;
      continue;
    }
    seen.add(trimmed);
    output.push(line);
  }

  return { result: output.join("\n"), removedCount };
}

/**
 * 3. Wording suggestions are speculative and must be reviewed before use.
 */
export function generateSafeSuggestions(text: string): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  if (!text || text.length < 20) return suggestions;

  // Check 1: Redundant whitespace
  const cleaned = cleanWhitespace(text);
  if (cleaned.length < text.length) {
    suggestions.push({
      id: "opt_whitespace",
      kind: "whitespace",
      title: "Clean redundant whitespace",
      description: "Normalize line endings and collapse excess blank lines outside fenced code.",
      originalText: text,
      optimizedText: cleaned,
      estimatedTokensSaved: Math.max(1, Math.ceil((text.length - cleaned.length) / 4)),
      requiresUserApproval: false,
      preservesSemantics: true
    });
  }

  // Check 2: Exact duplicate lines
  const dedup = deduplicateLines(cleaned);
  if (dedup.removedCount > 0) {
    suggestions.push({
      id: "opt_dedup",
      kind: "exact_deduplication",
      title: `Remove ${dedup.removedCount} duplicate line(s)`,
      description: "Identical duplicate lines detected and consolidated.",
      originalText: cleaned,
      optimizedText: dedup.result,
      estimatedTokensSaved: Math.max(1, Math.ceil((cleaned.length - dedup.result.length) / 4)),
      requiresUserApproval: true,
      preservesSemantics: false
    });
  }

  // Check 3: Polite conversational framing that can be tightened
  const verbosePhrases: Array<[RegExp, string, string]> = [
    [/\b(?:in order to)\b/gi, "to", "Simplify 'in order to' to 'to'"],
    [/\b(?:make sure that you)\b/gi, "ensure you", "Simplify 'make sure that you' to 'ensure you'"],
    [/\b(?:for the purpose of)\b/gi, "for", "Simplify 'for the purpose of' to 'for'"]
  ];

  let tightened = dedup.result;
  let phraseReplacements = 0;
  const lines = tightened.split("\n");
  const rewritten: string[] = [];
  let fence: FenceMarker | null = null;
  let inIndentedCode = false;
  for (const line of lines) {
    if (fence) {
      rewritten.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    if (inIndentedCode) {
      if (isMarkdownBlankLine(line) || isIndentedCodeLine(line)) {
        rewritten.push(line);
        continue;
      }
      inIndentedCode = false;
    }
    const marker = getFenceMarker(line);
    if (marker) {
      rewritten.push(line);
      fence = marker;
      continue;
    }
    if (isIndentedCodeLine(line)) {
      rewritten.push(line);
      inIndentedCode = true;
      continue;
    }
    let rewrittenLine = line;
    for (const [pattern, replacement] of verbosePhrases) {
      pattern.lastIndex = 0;
      if (pattern.test(rewrittenLine)) {
        rewrittenLine = rewrittenLine.replace(pattern, replacement);
        phraseReplacements += 1;
      }
    }
    rewritten.push(rewrittenLine);
  }
  tightened = rewritten.join("\n");

  if (phraseReplacements > 0 && tightened !== dedup.result) {
    suggestions.push({
      id: "opt_concise",
      kind: "semantic_reduction",
      title: "Tighten wordy phrasing",
      description: "Review a potentially meaning-changing wording simplification before use.",
      originalText: dedup.result,
      optimizedText: tightened,
      estimatedTokensSaved: Math.max(1, Math.ceil((dedup.result.length - tightened.length) / 4)),
      requiresUserApproval: true,
      preservesSemantics: false
    });
  }

  return suggestions;
}

export function getCopyShorterCandidate(text: string): string | null {
  const candidate = cleanWhitespace(text);
  return candidate.length < text.length ? candidate : null;
}
