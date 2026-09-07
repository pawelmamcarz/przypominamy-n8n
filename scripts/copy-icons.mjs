// Kopiuje ikony (svg/png) z nodes/ i credentials/ do dist/ — n8n ładuje je względem skompilowanych plików .node.js.
import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svg|png)$/i.test(name)) out.push(p);
  }
  return out;
}

let n = 0;
for (const base of ['nodes', 'credentials']) {
  const src = join(root, base);
  try { statSync(src); } catch { continue; }
  for (const file of walk(src)) {
    const rel = file.slice(root.length + 1);
    const dest = join(root, 'dist', rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(file, dest);
    n++;
  }
}
console.log(`copy-icons: skopiowano ${n} plik(ów) do dist/`);
