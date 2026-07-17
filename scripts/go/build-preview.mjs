import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

await mkdir('bin', { recursive: true });
const output =
  process.platform === 'win32' ? 'bin/synaploom-go-preview.exe' : 'bin/synaploom-go-preview';
execFileSync('go', ['build', '-o', output, './cmd/synaploom-preview'], { stdio: 'inherit' });
