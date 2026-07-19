import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { test } from 'vitest';

import { collectWebInventory } from '../scripts/go/web-inventory.mjs';

test('collectWebInventory returns a globally sorted inventory for nested assets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-web-inventory-'));
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<!doctype html>', 'utf8');
  await writeFile(path.join(root, 'assets', 'index.css'), '', 'utf8');
  await writeFile(path.join(root, 'assets', 'KaTeX.woff2'), '', 'utf8');

  assert.deepEqual(await collectWebInventory(root), [
    'dist/assets/KaTeX.woff2',
    'dist/assets/index.css',
    'dist/index.html',
  ]);
});
