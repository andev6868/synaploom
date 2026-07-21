import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

export async function buildGitBundle({ repositoryRoot = process.cwd() } = {}) {
  const root = path.resolve(repositoryRoot);
  const head = git(['rev-parse', 'HEAD'], root);
  const outputDirectory = path.join(root, 'artifacts', 'source');
  const filename = `synaploom-repository-${head.slice(0, 12)}.bundle`;
  const bundlePath = path.join(outputDirectory, filename);

  await mkdir(outputDirectory, { recursive: true });
  await rm(bundlePath, { force: true });
  execFileSync('git', ['bundle', 'create', bundlePath, '--all'], { cwd: root, stdio: 'inherit' });

  const refs = git(['bundle', 'list-heads', bundlePath], root);
  if (refs === '') throw new Error(`Git bundle contains no refs: ${bundlePath}`);

  const verificationRoot = await mkdtemp(path.join(os.tmpdir(), 'synaploom-git-bundle-'));
  const clonePath = path.join(verificationRoot, 'clone');
  try {
    execFileSync('git', ['clone', bundlePath, clonePath], { stdio: 'inherit' });
    const cloneHead = git(['rev-parse', 'HEAD'], clonePath);
    if (cloneHead !== head) {
      throw new Error(`Bundle clone HEAD ${cloneHead} does not match source HEAD ${head}`);
    }
    return { bundlePath, head, cloneHead };
  } finally {
    await rm(verificationRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await buildGitBundle();
  console.log(result.bundlePath);
}
