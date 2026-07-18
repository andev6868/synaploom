import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { goCommand } from './go-command.mjs';

await mkdir('bin', { recursive: true });
const { file, args, options } = goCommand(['build', '-o', 'bin/synaploom', './cmd/synaploom'], {
  stdio: 'inherit',
});
execFileSync(file, args, options);
