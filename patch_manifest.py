import json

with open('manifest.json', 'r', encoding='utf-8') as f:
    manifest = json.load(f)

if 'tabs' in manifest['permissions']:
    manifest['permissions'].remove('tabs')

with open('manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)
