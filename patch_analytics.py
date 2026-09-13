import re

with open('src/analytics/usageAnalytics.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacer = '''export function eventCost(event: any, preferences: any) {
  const breakdown = calculateCost(event.promptTokens, event.outputTokens, event.model, event.site);
  return breakdown.totalCost || 0;
}'''

content = re.sub(
    r'export function eventCost\(event: any, preferences: any\).*?\}\n',
    replacer + '\n',
    content,
    flags=re.DOTALL
)
content = content.replace(
    'import { SITE_LABELS, resolveModelProfile, modelLabelForDisplay, DEFAULT_PREFERENCES } from \'../lib/constants.js\';',
    'import { SITE_LABELS, modelLabelForDisplay, DEFAULT_PREFERENCES } from \'../lib/constants.js\';\nimport { calculateCost } from \'../models/registry.js\';'
)

with open('src/analytics/usageAnalytics.ts', 'w', encoding='utf-8') as f:
    f.write(content)
