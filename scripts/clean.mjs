import { rm } from 'node:fs/promises';
import path from 'node:path';

const roots = ['apps', 'packages', 'tooling'];
for (const root of roots) {
  const directories = await import('node:fs/promises').then(({ readdir }) =>
    readdir(root, { withFileTypes: true }).catch(() => []),
  );
  for (const entry of directories) {
    if (!entry.isDirectory()) continue;
    await Promise.all([
      rm(path.join(root, entry.name, 'dist'), { recursive: true, force: true }),
      rm(path.join(root, entry.name, 'dist-types'), { recursive: true, force: true }),
      rm(path.join(root, entry.name, '.vite'), { recursive: true, force: true }),
    ]);
  }
}
await rm('artifacts', { recursive: true, force: true });
