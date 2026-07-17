import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('artifacts/source');
const stage = path.join(out, '.staging');
await rm(out, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const files = execFileSync('git', ['ls-files', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .sort();
const epoch = new Date('2000-01-01T00:00:00.000Z');
const manifest = [];
for (const file of files) {
  const source = path.resolve(file);
  const target = path.join(stage, file);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
  await utimes(target, epoch, epoch);
  manifest.push(
    `${createHash('sha256')
      .update(await readFile(source))
      .digest('hex')}  ${file}`,
  );
}
const manifestPath = path.join(stage, 'SOURCE-MANIFEST.sha256');
await writeFile(manifestPath, `${manifest.join('\n')}\n`);
await utimes(manifestPath, epoch, epoch);
const filename = `synaploom-source-${commit.slice(0, 12)}.zip`;
const zipPath = path.join(out, filename);
const result = spawnSync(
  'bash',
  [
    '-lc',
    `find . -type f -print0 | LC_ALL=C sort -z | xargs -0 zip -X -q ${JSON.stringify(zipPath)}`,
  ],
  { cwd: stage, stdio: 'inherit' },
);
if (result.status !== 0) throw new Error(`zip failed with status ${result.status}`);
execFileSync('unzip', ['-t', zipPath], { stdio: 'inherit' });
const sum = createHash('sha256')
  .update(await readFile(zipPath))
  .digest('hex');
await writeFile(`${zipPath}.sha256`, `${sum}  ${filename}\n`);
await rm(stage, { recursive: true, force: true });
console.log(zipPath);
