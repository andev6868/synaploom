import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('bin', { recursive: true });
execFileSync('go', ['build', '-o', 'bin/synaploom', './cmd/synaploom'], { stdio: 'inherit' });
