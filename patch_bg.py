import re

with open('src/background/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove MODEL_CATALOG definition
content = re.sub(r'var MODEL_CATALOG = \{.*?\n\};\n', '', content, flags=re.DOTALL)
content = re.sub(r'var MODEL_MATCHERS = \[.*?\];\n', '', content, flags=re.DOTALL)

# Remove local resolveModelProfile, calculateCost, normalizeModelKey, etc.
content = re.sub(r'function normalizeModelKey\(.*?\}.*?\n\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'function resolveModelProfile\(.*?\}.*?\n\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'function calculateCost\(.*?\}.*?\n\}\n', '', content, flags=re.DOTALL)

# Add import at the top (after // @ts-nocheck and // src/lib/constants.ts)
import_stmt = \"import { resolveModelProfile, calculateCost, normalizeModelKey, MODEL_CATALOG, MODEL_MATCHERS } from '../models/registry';\\n\"
content = re.sub(r'(// @ts-nocheck\n// src/lib/constants.ts\n)', r'\\1' + import_stmt, content, count=1)

with open('src/background/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
