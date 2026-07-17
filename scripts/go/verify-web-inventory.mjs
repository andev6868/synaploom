import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = path.join(root, 'internal/webassets/dist');
async function collect(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute, relative)));
    else files.push(`dist/${relative}`);
  }
  return files;
}
const expected = JSON.parse(
  await readFile(path.join(root, 'internal/webassets/inventory.json'), 'utf8'),
);
const actual = await collect(target);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error('embedded Web inventory is stale');
  process.exit(1);
}
