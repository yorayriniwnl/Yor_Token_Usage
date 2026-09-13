import re

with open('src/types/models.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  currency: string;\n',
    '  currency: string;\n  notes?: string;\n'
)

with open('src/types/models.ts', 'w', encoding='utf-8') as f:
    f.write(content)
