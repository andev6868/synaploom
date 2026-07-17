import { readFileSync } from 'node:fs';
import { validateCanonicalFixture } from '../../../packages/course-schema/src/index.ts';

const [schema, fixturePath] = process.argv.slice(2);
if (!schema || !fixturePath) throw new Error('usage: typescript-runner <schema> <fixture>');
const payload: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'));
const result = validateCanonicalFixture(schema, payload);
process.stdout.write(`${JSON.stringify({ valid: result.valid })}\n`);
