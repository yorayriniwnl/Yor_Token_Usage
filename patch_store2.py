import re

with open('src/storage/store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    return '''  const promptTokens = boundedNonNegativeNumberOr(event.promptTokens, 2_000_000, null);
  const outputTokens = boundedNonNegativeNumberOr(event.outputTokens, 2_000_000, null);
  
  let sumTokens = null;
  if (promptTokens !== null && outputTokens !== null) {
      sumTokens = promptTokens + outputTokens;
  }
  
  let totalTokens = boundedNonNegativeNumberOr(event.totalTokens, 4_000_000, null);
  if (totalTokens === null && sumTokens !== null) totalTokens = sumTokens;
  if (totalTokens !== null && sumTokens !== null) {
      totalTokens = Math.min(4_000_000, Math.max(sumTokens, totalTokens));
  }'''

content = re.sub(
    r'  const promptTokens = boundedNonNegativeNumberOr\(event\.promptTokens, 2_000_000\);\s*const outputTokens = boundedNonNegativeNumberOr\(event\.outputTokens, 2_000_000\);\s*const totalTokens = Math\.min\(4_000_000, Math\.max\(promptTokens \+ outputTokens, boundedNonNegativeNumberOr\(event\.totalTokens, 4_000_000, promptTokens \+ outputTokens\)\)\);',
    replacer,
    content,
    flags=re.DOTALL
)

with open('src/storage/store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
