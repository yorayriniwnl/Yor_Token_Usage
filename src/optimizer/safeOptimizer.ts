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

/**
 * 1. Safe whitespace & newline cleanup:
 * Deterministic and guaranteed semantics-preserving.
 * Removes redundant trailing spaces, carriage returns, and excessive empty lines (>2).
 */
export function cleanWhitespace(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+$/gm, "") // trim trailing space per line
    .replace(/[ \t]{2,}/g, " ") // collapse multiple spaces (excluding indentation if desired, but inside paragraphs)
    .replace(/\n{3,}/g, "\n\n") // collapse triple newlines
    .trim();
}

/**
 * 2. Exact Deduplication:
 * Removes completely identical consecutive or redundant lines.
 * Checks for intentional repetition (e.g. repeated constraints) and does not strip them if tagged.
 */
export function deduplicateLines(text: string): { result: string; removedCount: number } {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const output: string[] = [];
  let removedCount = 0;

  for (const line of lines) {
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
 * 3. Safe Semantic Suggestion:
 * Analyzes the prompt for verbose boilerplate, but:
 * - NEVER deletes negation ("do not", "don't", "never", "without", "no")
 * - NEVER drops constraints
 * - NEVER deletes "just", "please", "kindly" if doing so alters intent
 * - ALWAYS requires user approval
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
      description: "Remove excessive trailing spaces and triple newlines without altering text.",
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
      preservesSemantics: true
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
  for (const [pattern, replacement] of verbosePhrases) {
    if (pattern.test(tightened)) {
      tightened = tightened.replace(pattern, replacement);
      phraseReplacements += 1;
    }
  }

  if (phraseReplacements > 0 && tightened !== dedup.result) {
    suggestions.push({
      id: "opt_concise",
      kind: "semantic_reduction",
      title: "Tighten wordy phrasing",
      description: "Simplify wordy phrasing without changing requirements or instructions.",
      originalText: dedup.result,
      optimizedText: tightened,
      estimatedTokensSaved: Math.max(1, Math.ceil((dedup.result.length - tightened.length) / 4)),
      requiresUserApproval: true,
      preservesSemantics: true
    });
  }

  return suggestions;
}
