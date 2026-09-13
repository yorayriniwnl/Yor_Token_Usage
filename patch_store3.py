import re

with open('src/storage/store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacer = '''export function nonNegativeNumberOr(value: any, fallback: any = 0) {
  if (value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}'''

content = re.sub(
    r'export function nonNegativeNumberOr.*?\}',
    replacer,
    content,
    flags=re.DOTALL,
    count=1
)

with open('src/storage/store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
