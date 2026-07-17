import { readdir, readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';

const roots = ['apps', 'packages', 'tests', 'tooling'];
const files = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (['dist', 'dist-types', 'node_modules'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(target);
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
      files.push(target);
  }
}
for (const root of roots) await visit(root);
for (const file of files) {
  try {
    stripTypeScriptTypes(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Node type-strip compatibility failed for ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
console.log(`Type-strip compatibility checked for ${files.length} TypeScript files.`);
