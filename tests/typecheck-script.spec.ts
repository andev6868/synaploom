import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'vitest';

test('type-strip compatibility check does not require a globally installed TypeScript package', () => {
  const result = spawnSync(process.execPath, ['scripts/check-type-strip.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: '/nonexistent',
      NODE_OPTIONS: '--disable-warning=ExperimentalWarning',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Type-strip compatibility checked for \d+ TypeScript files\./);
});

test('package scripts do not invoke Corepack or a bare Go executable', async () => {
  const packageJson = JSON.parse(
    await import('node:fs/promises').then(({ readFile }) => readFile('package.json', 'utf8')),
  ) as { scripts: Record<string, string> };
  const scripts = Object.values(packageJson.scripts).join('\n');
  assert.doesNotMatch(scripts, /corepack pnpm/);
  assert.doesNotMatch(scripts, /(?:^|&&\s*)go (?:run|build|test|vet)\b/m);
});
