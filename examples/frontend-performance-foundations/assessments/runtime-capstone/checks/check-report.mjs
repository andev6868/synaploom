import { readFile } from 'node:fs/promises';
const report = await readFile('performance-report.md', 'utf8');
const required = [
  '## Symptoms',
  '## Main-thread diagnosis',
  '## Event-loop diagnosis',
  '## Remediation plan',
  '## Verification plan',
];
const missing = required.filter((heading) => !report.includes(heading));
if (missing.length) {
  console.error(`Missing sections: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Assessment report is complete.');
