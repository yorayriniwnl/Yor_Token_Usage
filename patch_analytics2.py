import re

with open('src/analytics/usageAnalytics.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacer = '''export function eventCost(event: any, preferences: any) {
  const breakdown = calculateCost(event.promptTokens, event.outputTokens, event.model, event.site);
  return breakdown.totalCost || 0;
}'''

content = re.sub(
    r'export function eventCost.*?\}',
    replacer,
    content,
    flags=re.DOTALL,
    count=2
)

with open('src/analytics/usageAnalytics.ts', 'w', encoding='utf-8') as f:
    f.write(content)
