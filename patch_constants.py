import re
with open('src/lib/constants.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('findKnownModelProfile(model)', 'resolveModelProfile(model)')

with open('src/lib/constants.ts', 'w', encoding='utf-8') as f:
    f.write(content)
