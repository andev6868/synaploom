import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
export const targets = [
  'darwin/amd64',
  'darwin/arm64',
  'linux/amd64',
  'linux/arm64',
  'windows/amd64',
  'windows/arm64',
];
const out = path.resolve('artifacts/native');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const version = process.env.SYNAPLOOM_VERSION ?? '0.2.0';
const commit =
  process.env.SYNAPLOOM_COMMIT ??
  execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
const schema = process.env.SYNAPLOOM_SCHEMA_VERSION ?? '1.0.0';
const sums = [];
for (const target of targets) {
  const [goos, goarch] = target.split('/');
  const ext = goos === 'windows' ? '.exe' : '';
  const filename = `synaploom-${goos}-${goarch}${ext}`;
  const file = path.join(out, filename);
  execFileSync(
    'go',
    [
      'build',
      '-trimpath',
      '-ldflags',
      `-s -w -X github.com/synaploom/synaploom/internal/buildinfo.Version=${version} -X github.com/synaploom/synaploom/internal/buildinfo.Commit=${commit} -X github.com/synaploom/synaploom/internal/buildinfo.SchemaVersion=${schema}`,
      '-o',
      file,
      './cmd/synaploom',
    ],
    { stdio: 'inherit', env: { ...process.env, CGO_ENABLED: '0', GOOS: goos, GOARCH: goarch } },
  );
  if (goos !== 'windows') await chmod(file, 0o755);
  sums.push(
    `${createHash('sha256')
      .update(await readFile(file))
      .digest('hex')}  ${filename}`,
  );
}
await writeFile(path.join(out, 'SHA256SUMS'), `${sums.join('\n')}\n`);
await writeFile(
  path.join(out, 'release-inventory.json'),
  `${JSON.stringify(
    {
      version,
      commit,
      schema,
      artifacts: await Promise.all(
        sums.map(async (line) => {
          const [sha256, filename] = line.split(/\s+/);
          return {
            target: filename
              .replace(/^synaploom-/, '')
              .replace(/\.exe$/, '')
              .replace('-', '/'),
            filename,
            sha256,
            sizeBytes: (await stat(path.join(out, filename))).size,
          };
        }),
      ),
    },
    null,
    2,
  )}\n`,
);
