import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { encode } from "gpt-tokenizer";

await import(new URL("../content/accuracy-engine.js", import.meta.url));

const engine = globalThis.YorTokenAccuracy;
assert.ok(engine, "accuracy engine did not install itself");

const corpus = [
  {
    category: "english",
    samples: [
      "Summarize the decision, name the tradeoffs, and give me the next three actions.",
      "Explain why a small change in latency can alter perceived quality in a user interface."
    ]
  },
  {
    category: "hindi",
    samples: [
      "कृपया इस अनुच्छेद का संक्षिप्त सारांश दें और मुख्य निर्णयों की सूची बनाएं।",
      "यह समझाइए कि उपयोगकर्ता के भरोसे के लिए स्पष्ट स्रोत और सीमाएं क्यों जरूरी हैं।"
    ]
  },
  {
    category: "hinglish",
    samples: [
      "Is flow ko simple rakho, lekin failure state aur retry behavior clearly explain karo.",
      "Mujhe ek practical checklist do jo mobile aur desktop dono par kaam kare."
    ]
  },
  {
    category: "code",
    samples: [
      "```ts\nexport function clamp(value: number, min: number, max: number) {\n  return Math.min(max, Math.max(min, value));\n}\n```",
      "```js\nconst response = await fetch(url, { method: \"POST\", credentials: \"omit\" });\nif (!response.ok) throw new Error(`HTTP ${response.status}`);\n```"
    ]
  },
  {
    category: "markdown",
    samples: [
      "# Release checklist\n\n- Verify the build\n- Test the offline state\n- Measure the settled render\n\n> A green build is not deployment proof.",
      "## Acceptance criteria\n\n1. No horizontal overflow at 320px.\n2. Keyboard focus remains visible.\n3. Reduced motion removes non-essential transitions."
    ]
  },
  {
    category: "json",
    samples: [
      '{"provider":"chatgpt","model":"gpt-4.1","status":"completed","tokens":{"input":120,"output":300}}',
      '{"settings":{"privacyMode":"local-only","showOverlay":true},"events":[{"id":"evt_01","total":420}]} '
    ]
  },
  {
    category: "emoji-unicode",
    samples: [
      "Review this ✨ workflow — keep the signal clear across हिन्दी, 日本語, العربية, and emoji 🚀.",
      "👩🏽‍💻 → 🧪 → ✅; preserve zero-width joiners, accents, and non-Latin punctuation."
    ]
  },
  {
    category: "math",
    samples: [
      "Solve x² + 2x + 1 = 0, then explain the result using the derivative of f(x) = x³ − 4x.",
      "Compare O(n log n) with O(n²) for n = 1024 and state the practical implication."
    ]
  },
  {
    category: "urls",
    samples: [
      "Read https://platform.openai.com/docs/guides/text and compare it with https://example.com/reference.",
      "https://github.com/yorayriniwnl/Yor_Token_Usage/issues/1"
    ]
  },
  {
    category: "large-mixed",
    samples: [
      Array.from({ length: 80 }, (_, index) => `${index + 1}. Explain the evidence, risk, and fallback for the ${index % 4 === 0 ? "provider adapter" : index % 4 === 1 ? "offline queue" : index % 4 === 2 ? "responsive overlay" : "calibration report"}.`).join("\n"),
      `${"A careful estimate must disclose its source and error bound. ".repeat(80)}\n\n\`\`\`json\n{"ok":true,"confidence":0.5}\n\`\`\``
    ]
  }
];

const records = [];
const startedAt = performance.now();
for (const group of corpus) {
  for (const text of group.samples) {
    const first = engine.estimateTokenBreakdown(text).total;
    const second = engine.estimateTokenBreakdown(text).total;
    const reference = encode(text).length;
    assert.equal(first, second, `non-deterministic estimate in ${group.category}`);
    assert.ok(Number.isInteger(first) && first >= 0, `invalid estimate in ${group.category}`);
    assert.ok(Number.isInteger(reference) && reference >= 0, `invalid reference in ${group.category}`);
    records.push({
      category: group.category,
      estimate: first,
      reference,
      absoluteError: Math.abs(first - reference),
      absolutePercentError: reference ? Math.abs(first - reference) / reference * 100 : 0,
      signedPercentError: reference ? (first - reference) / reference * 100 : 0
    });
  }
}

function quantile(values, probability) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * probability) - 1)];
}

function summarize(items) {
  const absoluteErrors = items.map((item) => item.absoluteError);
  const absolutePercentErrors = items.map((item) => item.absolutePercentError);
  const signedPercentErrors = items.map((item) => item.signedPercentError);
  const referenceTotal = items.reduce((sum, item) => sum + item.reference, 0);
  const estimateTotal = items.reduce((sum, item) => sum + item.estimate, 0);
  return {
    samples: items.length,
    meanAbsoluteError: absoluteErrors.reduce((sum, value) => sum + value, 0) / Math.max(1, items.length),
    meanAbsolutePercentError: absolutePercentErrors.reduce((sum, value) => sum + value, 0) / Math.max(1, items.length),
    medianAbsolutePercentError: quantile(absolutePercentErrors, 0.5),
    p95AbsolutePercentError: quantile(absolutePercentErrors, 0.95),
    maxAbsolutePercentError: Math.max(0, ...absolutePercentErrors),
    meanSignedPercentError: signedPercentErrors.reduce((sum, value) => sum + value, 0) / Math.max(1, items.length),
    aggregateEstimate: estimateTotal,
    aggregateReference: referenceTotal,
    aggregatePercentError: referenceTotal ? Math.abs(estimateTotal - referenceTotal) / referenceTotal * 100 : 0
  };
}

const categories = Object.fromEntries(corpus.map(({ category }) => {
  const items = records.filter((record) => record.category === category);
  return [category, summarize(items)];
}));
const summary = summarize(records);
const runtimeMs = Number((performance.now() - startedAt).toFixed(2));
const performanceBudgetMs = 500;
assert.ok(runtimeMs <= performanceBudgetMs, `calibration benchmark exceeded ${performanceBudgetMs}ms`);
const measurement = engine.createMeasurement({
  provider: "benchmark",
  model: "o200k_base reference",
  adapterConfidence: 0.5,
  source: "offline calibration corpus"
});
assert.equal(measurement.measurementLevel, "approximation");
assert.equal(measurement.tokenizer, "none");
assert.ok(summary.maxAbsolutePercentError <= measurement.errorMarginPercent, "calibration corpus exceeded the configured error bound");

const result = {
  benchmarkVersion: 1,
  referenceTokenizer: "gpt-tokenizer@4.0.0 / o200k_base",
  referenceScope: "OpenAI BPE reference only; this is not provider billing truth or Anthropic/Gemini token ground truth.",
  estimator: {
    method: measurement.measurementMethod,
    level: measurement.measurementLevel,
    configuredErrorMarginPercent: measurement.errorMarginPercent,
    confidenceAtAdapterConfidence50: measurement.confidence
  },
  summary,
  categories,
  performanceBudgetMs,
  runtimeMs
};

const markdown = [
  "# Token measurement calibration",
  "",
  "> This is a calibration reference, not a provider-authoritative usage report.",
  "",
  `- Reference: \`${result.referenceTokenizer}\`.`,
  `- Scope: ${result.referenceScope}`,
  `- Estimator: \`${result.estimator.method}\` (${result.estimator.level}), configured bound ±${result.estimator.configuredErrorMarginPercent}%.`,
  `- Corpus: ${summary.samples} deterministic samples across ${Object.keys(categories).length} stress categories.`,
  `- Benchmark performance budget: ${result.performanceBudgetMs} ms.`,
  "",
  "## Aggregate result",
  "",
  "| Metric | Result |",
  "| --- | ---: |",
  `| Mean absolute error | ${summary.meanAbsoluteError.toFixed(2)} tokens |`,
  `| Mean absolute percentage error | ${summary.meanAbsolutePercentError.toFixed(2)}% |`,
  `| Median absolute percentage error | ${summary.medianAbsolutePercentError.toFixed(2)}% |`,
  `| P95 absolute percentage error | ${summary.p95AbsolutePercentError.toFixed(2)}% |`,
  `| Maximum absolute percentage error | ${summary.maxAbsolutePercentError.toFixed(2)}% |`,
  `| Aggregate percentage error | ${summary.aggregatePercentError.toFixed(2)}% |`,
  "",
  "## By category",
  "",
  "| Category | Samples | Mean abs. % | P95 abs. % | Max abs. % | Signed mean % |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...Object.entries(categories).map(([category, item]) => `| ${category} | ${item.samples} | ${item.meanAbsolutePercentError.toFixed(2)}% | ${item.p95AbsolutePercentError.toFixed(2)}% | ${item.maxAbsolutePercentError.toFixed(2)}% | ${item.meanSignedPercentError.toFixed(2)}% |`),
  "",
  "## Interpretation",
  "",
  "The extension intentionally keeps this method at `approximation` level because visible provider DOM text does not expose the provider's serialized request, hidden system context, tool calls, image tokenization, or billing counters. The benchmark can tune the displayed error bound for this corpus, but it cannot prove provider billing accuracy.",
  "",
  "Regenerate with `npm run accuracy:benchmark -- --write` after changing the estimator or corpus."
].join("\n");

if (process.argv.includes("--write")) {
  await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
  const persistedResult = { ...result };
  delete persistedResult.runtimeMs;
  await writeFile(new URL("../docs/accuracy-benchmark.json", import.meta.url), `${JSON.stringify(persistedResult, null, 2)}\n`);
  await writeFile(new URL("../docs/accuracy-benchmark.md", import.meta.url), `${markdown}\n`);
}

console.log(JSON.stringify(result, null, 2));
