import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { forwardOutput, parseCoursePath, rewriteBootstrapURL } from './full.mjs';

test('requires exactly one course path', () => {
  assert.equal(parseCoursePath(['examples/course']), 'examples/course');
  assert.equal(parseCoursePath(['--', 'examples/course']), 'examples/course');
  assert.throws(() => parseCoursePath([]), /requires exactly one course path/);
  assert.throws(() => parseCoursePath(['one', 'two']), /requires exactly one course path/);
});

test('rewrites only the bootstrap origin for Vite', () => {
  assert.equal(
    rewriteBootstrapURL(
      'http://127.0.0.1:4174/bootstrap?token=one-time-token',
      'http://127.0.0.1:5173',
    ),
    'http://127.0.0.1:5173/bootstrap?token=one-time-token',
  );
});

test('forwards all frontend output without consuming it', () => {
  const frontendOutput = new PassThrough();
  const terminal = new PassThrough();
  let received = '';
  terminal.setEncoding('utf8');
  terminal.on('data', (chunk) => {
    received += chunk;
  });

  forwardOutput(frontendOutput, terminal);
  frontendOutput.write('VITE v7 ready\n');
  frontendOutput.write('hmr update /src/application.css\n');

  assert.equal(received, 'VITE v7 ready\nhmr update /src/application.css\n');
});
