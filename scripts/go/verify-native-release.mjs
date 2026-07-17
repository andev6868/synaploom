import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const out = path.resolve('artifacts/native');
const lines = (await readFile(path.join(out, 'SHA256SUMS'), 'utf8')).trim().split('\n');
for (const line of lines) {
  const [expected, file] = line.trim().split(/\s+/);
  const full = path.join(out, file);
  await access(full);
  const actual = createHash('sha256')
    .update(await readFile(full))
    .digest('hex');
  if (actual !== expected) throw new Error(`checksum mismatch ${file}`);
}
const p = process.platform === 'win32' ? 'windows' : process.platform;
const a = process.arch === 'x64' ? 'amd64' : process.arch;
const host = path.join(out, `synaploom-${p}-${a}${p === 'windows' ? '.exe' : ''}`);
if (!execFileSync(host, ['version'], { encoding: 'utf8' }).includes('schema='))
  throw new Error('version smoke failed');
JSON.parse(execFileSync(host, ['doctor', '--json'], { encoding: 'utf8' }));
console.log(`verified ${lines.length} native artifacts`);
