import re

with open('src/storage/store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacer = '''export function boundedNonNegativeNumberOr(value: any, max: any, fallback: any = 0) {
  if (value === null) return null;
  const num = nonNegativeNumberOr(value, fallback);
  if (num === null) return null;
  return Math.min(max, num);
}'''

content = re.sub(
    r'export function boundedNonNegativeNumberOr.*?\}',
    replacer,
    content,
    flags=re.DOTALL,
    count=1
)

with open('src/storage/store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
