import re

with open('src/lib/constants.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "export { resolveModelProfile, calculateCost, normalizeModelKey, MODEL_CATALOG, MODEL_MATCHERS } from '../models/registry.js';",
    "import { resolveModelProfile, calculateCost, normalizeModelKey, MODEL_CATALOG, MODEL_MATCHERS } from '../models/registry.js';\nexport { resolveModelProfile, calculateCost, normalizeModelKey, MODEL_CATALOG, MODEL_MATCHERS };"
)

with open('src/lib/constants.ts', 'w', encoding='utf-8') as f:
    f.write(content)
