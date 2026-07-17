import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveInsideRoot, assertNoEscapingSymlink } from '#src/paths';

for (const value of ['../secret', '../../etc/passwd', '/etc/passwd']) {
  test(`rejects ${value}`, () => {
    assert.throws(() => resolveInsideRoot('/course', value), /PATH_OUTSIDE_ROOT/);
  });
}

test('accepts contained relative paths', () => {
  assert.equal(resolveInsideRoot('/course', 'lessons/01'), path.resolve('/course/lessons/01'));
});

test('rejects escaping symlinks', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-path-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'synaploom-outside-'));
  await writeFile(path.join(outside, 'secret.txt'), 'secret');
  await mkdir(path.join(root, 'lessons'));
  await symlink(path.join(outside, 'secret.txt'), path.join(root, 'lessons', 'secret.txt'));
  await assert.rejects(
    () => assertNoEscapingSymlink(root, path.join(root, 'lessons', 'secret.txt')),
    /SYMLINK_OUTSIDE_ROOT/,
  );
});
