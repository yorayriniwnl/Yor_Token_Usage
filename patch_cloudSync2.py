import re

with open('src/cloud/cloudSync.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('config.skippedExpiredEvents += skippedExpired;', '(config.skippedExpiredEvents ??= 0);\n        config.skippedExpiredEvents += skippedExpired;')
content = content.replace('event.totalTokens', '(event.totalTokens ?? 0)')

with open('src/cloud/cloudSync.ts', 'w', encoding='utf-8') as f:
    f.write(content)
