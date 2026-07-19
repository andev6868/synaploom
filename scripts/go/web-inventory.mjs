import { readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Collect the embedded web asset inventory in a stable, globally sorted order.
 *
 * @param {string} directory
 * @param {{ includeSourceMaps?: boolean }} [options]
 * @returns {Promise<string[]>}
 */
export async function collectWebInventory(directory, options = {}) {
  const includeSourceMaps = options.includeSourceMaps ?? true;

  async function collect(current, prefix = '') {
    const entries = await readdir(current, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collect(absolute, relative)));
      } else if (includeSourceMaps || !entry.name.endsWith('.map')) {
        files.push(`dist/${relative}`);
      }
    }

    return files;
  }

  return (await collect(directory)).sort();
}
