import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'apps/web/dist');
const target = path.join(root, 'internal/webassets/dist');
const inventoryPath = path.join(root, 'internal/webassets/inventory.json');
const includeSourceMaps = process.env.SYNAPLOOM_RELEASE_SOURCEMAPS === '1';

async function collect(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute, relative)));
    else if (includeSourceMaps || !entry.name.endsWith('.map')) files.push(relative);
  }
  return files;
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, {
  recursive: true,
  filter(sourcePath) {
    return includeSourceMaps || !sourcePath.endsWith('.map');
  },
});
const files = (await collect(target)).map((file) => `dist/${file}`);
const config = await prettier.resolveConfig(inventoryPath);
const formatted = await prettier.format(JSON.stringify(files.sort()), {
  ...config,
  filepath: inventoryPath,
});
await writeFile(inventoryPath, formatted, 'utf8');
