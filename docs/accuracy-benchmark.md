# Token measurement calibration

> This is a calibration reference, not a provider-authoritative usage report.

- Reference: `gpt-tokenizer@4.0.0 / o200k_base`.
- Scope: OpenAI BPE reference only; this is not provider billing truth or Anthropic/Gemini token ground truth.
- Estimator: `dom-text-heuristic` (approximation), configured bound ±40%.
- Corpus: 20 deterministic samples across 10 stress categories.
- Benchmark performance budget: 500 ms.

## Aggregate result

| Metric | Result |
| --- | ---: |
| Mean absolute error | 33.45 tokens |
| Mean absolute percentage error | 17.97% |
| Median absolute percentage error | 13.33% |
| P95 absolute percentage error | 37.50% |
| Maximum absolute percentage error | 37.61% |
| Aggregate percentage error | 23.65% |

## By category

| Category | Samples | Mean abs. % | P95 abs. % | Max abs. % | Signed mean % |
| --- | ---: | ---: | ---: | ---: | ---: |
| english | 2 | 21.38% | 37.50% | 37.50% | 21.38% |
| hindi | 2 | 10.76% | 12.00% | 12.00% | -1.24% |
| hinglish | 2 | 16.99% | 22.22% | 22.22% | 16.99% |
| code | 2 | 15.52% | 18.92% | 18.92% | 15.52% |
| markdown | 2 | 20.00% | 26.67% | 26.67% | 20.00% |
| json | 2 | 10.11% | 13.33% | 13.33% | -10.11% |
| emoji-unicode | 2 | 12.89% | 21.43% | 21.43% | -8.54% |
| math | 2 | 21.01% | 33.33% | 33.33% | -21.01% |
| urls | 2 | 21.59% | 25.00% | 25.00% | -3.41% |
| large-mixed | 2 | 29.47% | 37.61% | 37.61% | 29.47% |

## Interpretation

The extension intentionally keeps this method at `approximation` level because visible provider DOM text does not expose the provider's serialized request, hidden system context, tool calls, image tokenization, or billing counters. The benchmark can tune the displayed error bound for this corpus, but it cannot prove provider billing accuracy.

Regenerate with `npm run accuracy:benchmark -- --write` after changing the estimator or corpus.
