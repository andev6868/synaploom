import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
const readJson = async (path: string) =>
  JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
test('package metadata declares the Web tooling Node compatibility floor', async () => {
  assert.equal((await readJson('package.json')).engines?.node, '>=22.13.0');
});
test('pnpm allows the Vite esbuild install script explicitly', async () => {
  assert.match(
    await readFile('pnpm-workspace.yaml', 'utf8'),
    /allowBuilds:\s*\n\s+esbuild:\s+true/,
  );
});
test('source tree does not track a self-referential checksum manifest', async () => {
  await assert.rejects(readFile('FILE-MANIFEST.sha256', 'utf8'), { code: 'ENOENT' });
});
test('pins the Go toolchain and exposes native verification scripts', async () => {
  const m = await readFile('go.mod', 'utf8');
  const s = (await readJson('package.json')).scripts as Record<string, string>;
  assert.match(m, /go 1\.26/);
  assert.match(m, /toolchain go1\.26\.5/);
  assert.equal(s['go:staticcheck'], 'go tool staticcheck ./...');
});
test('documents and builds the native synaploom executable as default', async () => {
  const r = await readFile('README.md', 'utf8');
  assert.match(r, /synaploom start/);
  assert.doesNotMatch(r, /npm install -g @synaploom\/cli/);
  await readFile('cmd/synaploom/main.go', 'utf8');
});

test('documents the native architecture and verified release matrix', async () => {
  const report = await readFile('docs/releases/go-core-migration-verification.md', 'utf8');
  assert.match(report, /darwin\/amd64/);
  assert.match(report, /windows\/arm64/);
  assert.match(report, /Node-created database migration/);
  assert.match(report, /Playwright/);
  await readFile('docs/architecture/go-core.md', 'utf8');
  await readFile('scripts/go/archive-source.mjs', 'utf8');
});
