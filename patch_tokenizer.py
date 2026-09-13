import re

with open('src/measurement/tokenizer.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace static import with dynamic loading
replacer = '''let encodeFn: ((text: string) => number[]) | null = null;

// Lazy load the heavy tokenizer
import('gpt-tokenizer').then(mod => {
  encodeFn = mod.encode;
}).catch(console.error);

export interface DeterministicTokenizerResult {'''

content = re.sub(
    r'import \{ encode \} from "gpt-tokenizer";\s*export interface DeterministicTokenizerResult \{',
    replacer,
    content,
    flags=re.DOTALL
)

# Replace encode(text).length with encodeFn(text).length
content = content.replace(
    'const tokens = encode(text).length;',
    'if (!encodeFn) return null;\n      const tokens = encodeFn(text).length;'
)

with open('src/measurement/tokenizer.ts', 'w', encoding='utf-8') as f:
    f.write(content)
