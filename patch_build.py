import re

with open('scripts/build.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'bundle: true,\\n      external: ["gpt-tokenizer"],',
    'bundle: true,\\n      external: target.outfile.endsWith("gpt-tokenizer.js") ? [] : ["gpt-tokenizer"],'
)

with open('scripts/build.mjs', 'w', encoding='utf-8') as f:
    f.write(content)
