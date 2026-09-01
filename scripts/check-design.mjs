import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = ['popup/popup.css', 'dashboard/dashboard.css', 'settings/settings.css'];
const required = [
  '#000000',
  '#050505',
  '#e84b4b',
  '#671515',
  '#ff8a7f',
  '#f5eaea',
  '#c4c4c4',
  'linear-gradient(135deg, #671515, #8c1616, #2a0505)',
];

for (const file of files) {
  const css = await readFile(new URL(file, root), 'utf8');
  const missing = required.filter((token) => !css.toLowerCase().includes(token.toLowerCase()));
  if (missing.length) {
    throw new Error(`${file}: missing ${missing.join(', ')}`);
  }
}

const manifest = await readFile(new URL('manifest.json', root), 'utf8');
if (!manifest.includes('YOR // Token Usage')) {
  throw new Error('manifest.json: YOR product name is missing');
}

console.log('YOR design contract: PASS');
