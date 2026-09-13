import re

with open('docs/audit/final-adversarial-audit.md', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'- \*\*Overlay Isolation\*\*: The DOM overlay renders exclusively inside a closed Shadow DOM container.*?into host elements\.\n',
    '- **Overlay Isolation**: The DOM overlay renders within the host page DOM and applies targeted CSS to minimize style bleed.\n',
    content,
    flags=re.DOTALL
)

with open('docs/audit/final-adversarial-audit.md', 'w', encoding='utf-8') as f:
    f.write(content)
