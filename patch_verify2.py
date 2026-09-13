import re

with open('scripts/verify-extension-runtime.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'throw new Error("import normalization did not enforce the history limit, length was " + imported?.state?.usageEvents?.length);',
    'throw new Error("import normalization did not enforce the history limit, length was " + imported?.state?.usageEvents?.length + "\\nimported.state = " + JSON.stringify(imported?.state).slice(0, 500));'
)

with open('scripts/verify-extension-runtime.mjs', 'w', encoding='utf-8') as f:
    f.write(content)
