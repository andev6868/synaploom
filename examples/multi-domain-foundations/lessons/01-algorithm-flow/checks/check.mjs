import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['index.js'], {
  encoding: 'utf8',
  env: { ...process.env, FORCE_COLOR: '0' },
});
const output = result.stdout.trim();
if (result.status !== 0 || output !== '5') {
  console.error(`Expected 5, received ${output}`);
  process.exit(1);
}
console.log('sum-output passed');
