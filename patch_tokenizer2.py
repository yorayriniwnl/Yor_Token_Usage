import re

with open('src/measurement/tokenizer.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacer = '''let encodeFn: ((text: string) => number[]) | null = null;

if (typeof document !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/gpt-tokenizer.js');
  script.onload = () => {
    encodeFn = (globalThis as any).GptTokenizer_encode;
  };
  document.head.appendChild(script);
} else {
  // Fallback for non-browser environments if any
  import('gpt-tokenizer').then(mod => { encodeFn = mod.encode; }).catch(() => {});
}

export interface DeterministicTokenizerResult {'''

content = re.sub(
    r'let encodeFn.*?export interface DeterministicTokenizerResult \{',
    replacer,
    content,
    flags=re.DOTALL
)

with open('src/measurement/tokenizer.ts', 'w', encoding='utf-8') as f:
    f.write(content)
