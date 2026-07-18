import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { goCommand } from './go-command.mjs';

await mkdir('bin', { recursive: true });
const output =
  process.platform === 'win32' ? 'bin/synaploom-go-preview.exe' : 'bin/synaploom-go-preview';
const { file, args, options } = goCommand(['build', '-o', output, './cmd/synaploom-preview'], {
  stdio: 'inherit',
});
execFileSync(file, args, options);
