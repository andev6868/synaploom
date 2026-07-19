import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

import { collectWebInventory } from './web-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'apps/web/dist');
const target = path.join(root, 'internal/webassets/dist');
const inventoryPath = path.join(root, 'internal/webassets/inventory.json');
const includeSourceMaps = process.env.SYNAPLOOM_RELEASE_SOURCEMAPS === '1';

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, {
  recursive: true,
  filter(sourcePath) {
    return includeSourceMaps || !sourcePath.endsWith('.map');
  },
});
const files = await collectWebInventory(target, { includeSourceMaps });
const config = await prettier.resolveConfig(inventoryPath);
const formatted = await prettier.format(JSON.stringify(files), {
  ...config,
  filepath: inventoryPath,
});
await writeFile(inventoryPath, formatted, 'utf8');
