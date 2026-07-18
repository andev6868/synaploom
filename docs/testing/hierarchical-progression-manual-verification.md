# Hierarchical Progression Manual Verification

Use this checklist after pulling the implementation branch. Send the complete terminal output and any screenshots for failed browser steps back to the implementation agent.

## 1. Environment

```bash
node --version
pnpm --version
bash scripts/go/with-internal-toolchain.sh version
git rev-parse HEAD
git status --short
```

Expected baseline: Node 22+, pnpm 11.13.0, Go 1.26.5, and a clean Git status.

## 2. Install and static gates

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm contracts:check
```

## 3. Automated behavior gates

```bash
pnpm test
pnpm go:test
pnpm go:vet
pnpm go:staticcheck
```

Run race checks separately to reduce memory pressure:

```bash
bash scripts/go/with-internal-toolchain.sh test -race ./internal/...
bash scripts/go/with-internal-toolchain.sh test -race ./tests/go-integration/...
```

## 4. Browser acceptance

```bash
pnpm go:stage-web
pnpm playwright install chromium
pnpm playwright test --project=go-runtime --headed
```

Manually verify:

1. A Course Schema 1.0 course appears as one implicit chapter.
2. Required lessons unlock sequentially.
3. Optional lessons never block the next required lesson.
4. A locked item shows a human-readable requirement.
5. Completed lessons remain clickable and open in review mode.
6. Opening review mode does not change the current lesson.
7. A chapter assessment is visually distinct from a lesson.
8. Completing the required assessment unlocks the next chapter.
9. Refreshing a canonical chapter-aware URL restores the same view.
10. A short compatibility lesson URL redirects to the canonical URL.

## 5. Persistence scenario

```bash
bash scripts/go/with-internal-toolchain.sh test ./tests/go-integration -run HierarchicalProgression -count=1 -v
```

Confirm the output covers restart persistence, best-result preservation after a later failure, review access, and unchanged current lesson.

## 6. Native release

```bash
pnpm go:release
pnpm go:verify-release
pnpm go:write-release-evidence
cat artifacts/native/release-inventory.json
cat artifacts/native/SHA256SUMS
git diff -- docs/releases/go-core-migration-verification.md
git status --short
```

Send back:

- The first failing command and its full output.
- Operating system and CPU architecture.
- `node --version`, `pnpm --version`, and internal Go version output.
- For browser failures, the Playwright trace path and screenshot.
- For native release failures, the target printed immediately before the error.
