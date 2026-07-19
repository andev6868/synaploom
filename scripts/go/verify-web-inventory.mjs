import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectWebInventory } from './web-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = path.join(root, 'internal/webassets/dist');
const expected = JSON.parse(
  await readFile(path.join(root, 'internal/webassets/inventory.json'), 'utf8'),
);
const actual = await collectWebInventory(target);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error('embedded Web inventory is stale');
  process.exit(1);
}
