const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['event-loop-demo.js'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 2000,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

const actual = result.stdout.trim().split(/\r?\n/);
const expected = ['start', 'end', 'promise', 'timeout'];

if (result.status !== 0 || JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error(`Expected: ${expected.join(' -> ')}`);
  console.error(`Received: ${actual.join(' -> ')}`);
  process.exit(1);
}

console.log('Event Loop output order is correct.');
