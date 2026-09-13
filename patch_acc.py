import re

with open('src/measurement/accuracy-engine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    return '''
  const attachmentTokensArr = attachmentSections.map((s) => s.tokens);
  const attachmentTokens = attachmentTokensArr.includes(null) ? null : sum(attachmentTokensArr as number[]);
  const total = attachmentTokens === null ? null : (deterministic.tokens + attachmentTokens);
  const measurement = createMeasurement({ ...options, tokenizer: options.tokenizer });
  if (total === null) measurement.measurementLevel = "unknown";
'''

content = re.sub(
    r'const attachmentTokens = sum\(attachmentSections\.map\(\(s\) => s\.tokens\)\);\s*const total = deterministic\.tokens \+ attachmentTokens;\s*const measurement = createMeasurement\(\{ \.\.\.options, tokenizer: options\.tokenizer \}\);',
    replacer,
    content,
    flags=re.DOTALL
)

def replacer_b(match):
    return '''
  const textTokens = sum(
    sections.filter((s) => ["prose", "instruction", "quote"].includes(s.type)).map((s) => s.tokens as number)
  );
  const codeTokens = sum(sections.filter((s) => s.type === "code").map((s) => s.tokens as number));
  const urlTokens = sum(sections.filter((s) => s.type === "url").map((s) => s.tokens as number));
  const attachmentTokensArr = sections.filter((s) => s.type === "attachment").map((s) => s.tokens);
  const attachmentTokens = attachmentTokensArr.includes(null) ? null : sum(attachmentTokensArr as number[]);
  const total = attachmentTokens === null ? null : (textTokens + codeTokens + urlTokens + attachmentTokens);
  const measurement = createMeasurement(options);
  if (total === null) measurement.measurementLevel = "unknown";
'''

content = re.sub(
    r'const textTokens = sum\([\s\S]*?const measurement = createMeasurement\(options\);',
    replacer_b,
    content,
    flags=re.DOTALL
)

# Fix return type in signature
content = re.sub(
    r'attachmentTokens: number;\s*total: number;',
    'attachmentTokens: number | null;\n  total: number | null;',
    content
)

with open('src/measurement/accuracy-engine.ts', 'w', encoding='utf-8') as f:
    f.write(content)
