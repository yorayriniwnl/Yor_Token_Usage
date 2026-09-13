import re

with open('src/models/registry.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'promptTokens: number,\n  outputTokens: number,',
    'promptTokens: number | null,\n  outputTokens: number | null,'
)

replacer = '''
  if (profile.inputCostPer1M === null || profile.outputCostPer1M === null) {
    return {
      promptCost: null,
      outputCost: null,
      totalCost: null,
      currency: "USD",
      isApiEquivalent: true,
      model: profile
    };
  }
  
  if (promptTokens === null || outputTokens === null) {
    return {
      promptCost: null,
      outputCost: null,
      totalCost: null,
      currency: "USD",
      isApiEquivalent: true,
      model: profile,
      notes: "UnmeasuredCost: token amounts are unknown"
    };
  }
'''

content = re.sub(
    r'if \(profile\.inputCostPer1M === null \|\| profile\.outputCostPer1M === null\) \{[\s\S]*?model: profile\n    \};\n  \}',
    replacer,
    content
)

with open('src/models/registry.ts', 'w', encoding='utf-8') as f:
    f.write(content)
