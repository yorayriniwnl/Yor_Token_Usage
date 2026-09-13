import re

with open('src/background/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacer = '''function eventCost(event, preferences) {
  const breakdown = calculateCost(event.promptTokens, event.outputTokens, event.model, event.site);
  return breakdown.totalCost || 0;
}'''

content = re.sub(
    r'function eventCost\(event, preferences\) \{.*?\n\}\n',
    replacer + '\n',
    content,
    flags=re.DOTALL
)

with open('src/background/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
