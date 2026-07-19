import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const vitestPackage = fileURLToPath(import.meta.resolve('vitest/package.json'));
const vitestEntry = path.join(path.dirname(vitestPackage), 'vitest.mjs');
const activityPrefixes = [
  'apps/web/src/features/activity-engine/',
  'apps/web/src/features/lesson-content/',
  'apps/web/src/features/chapter-assessment/',
];

async function collectTests(directory) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
    recursive: true,
  });
  return entries
    .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
    .map((entry) =>
      path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'),
    );
}

function runVitest(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [vitestEntry, 'run', '--pool=forks', '--reporter=verbose', ...args],
      {
        cwd: root,
        env: process.env,
        stdio: 'inherit',
      },
    );
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Vitest exited with ${code ?? signal ?? 'unknown status'}`));
    });
  });
}

const domTests = [
  ...(await collectTests('apps/web/src')),
  ...(await collectTests('packages/ui/src')),
].sort();
const activityTests = domTests.filter((file) =>
  activityPrefixes.some((prefix) => file.startsWith(prefix)),
);
const workspaceTests = domTests.filter((file) => !activityTests.includes(file));

try {
  await runVitest(['--project', 'dom', '--maxWorkers=1', ...activityTests]);
  await runVitest(['--project', 'dom', '--maxWorkers=1', ...workspaceTests]);
  await runVitest(['--project', 'node', '--maxWorkers=1']);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
