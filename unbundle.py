import re
import os

with open('src/background/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

parts = re.split(r'\n(?=// src/)', content)

for part in parts:
    if not part.strip(): continue
    lines = part.strip().split('\n')
    header = lines[0]
    if header.startswith('// src/'):
        filename = header[7:].strip()
        filepath = os.path.join('src', 'background', os.path.basename(filename))
        
        # Write to the new file
        with open(filepath, 'w', encoding='utf-8') as out:
            out.write('\n'.join(lines[1:]))
            print(f'Wrote {filepath}')
