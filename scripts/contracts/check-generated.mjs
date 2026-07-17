import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const path = 'generated/typescript/index.ts';
const before = readFileSync(path, 'utf8');
execFileSync(process.execPath, ['scripts/contracts/generate-typescript.mjs'], { stdio: 'inherit' });
const after = readFileSync(path, 'utf8');
if (before !== after) {
  console.error(`${path} is stale; run pnpm contracts:generate`);
  process.exit(1);
}
