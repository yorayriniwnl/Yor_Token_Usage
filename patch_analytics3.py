import re

with open('src/analytics/usageAnalytics.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import { nonNegativeNumberOr, usageEventIdentity } from \\'../storage/store.js\\';', 'import { usageEventIdentity } from \\'../storage/store.js\\';')

with open('src/analytics/usageAnalytics.ts', 'w', encoding='utf-8') as f:
    f.write(content)
