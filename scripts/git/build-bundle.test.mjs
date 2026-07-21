import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildGitBundle } from './build-bundle.mjs';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

test('creates a complete cloneable bundle for all local refs', async (t) => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'synaploom-git-bundle-test-'));
  t.after(async () => rm(repositoryRoot, { recursive: true, force: true }));

  git(['init'], repositoryRoot);
  git(['config', 'user.name', 'Synaploom Test'], repositoryRoot);
  git(['config', 'user.email', 'test@synaploom.local'], repositoryRoot);
  await writeFile(path.join(repositoryRoot, 'README.md'), '# Bundle test\n');
  git(['add', 'README.md'], repositoryRoot);
  git(['commit', '-m', 'Initial commit'], repositoryRoot);
  git(['branch', 'recovery'], repositoryRoot);

  const result = await buildGitBundle({ repositoryRoot });

  assert.match(result.bundlePath, /artifacts[\\/]source[\\/]synaploom-repository-[0-9a-f]{12}\.bundle$/);
  assert.equal(git(['rev-parse', 'HEAD'], repositoryRoot), result.head);
  assert.match(git(['bundle', 'list-heads', result.bundlePath], repositoryRoot), /refs\/heads\/recovery/);
  assert.equal(result.cloneHead, result.head);
});
