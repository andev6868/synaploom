# Single Active Workspace Revision 2.1 Verification

**Verification date:** 2026-07-20  
**Verified implementation commit:** `c6d8c978bd28`  
**Branch:** `work/single-active-workspace-r21-visual-fidelity`

## Scope

Revision 2.1 closes the visual-fidelity gaps found after Revision 2 without changing the single-editor, save-before-switch, optimistic conflict, refresh persistence, or process-restart contracts.

The verified changes cover:

- bounded viewport composition with independent Theory, Practice, and Navigator scrolling;
- stable workspace-level AI dock that remains inside the viewport;
- Theory progress, table, callout, spacing, and reading-measure details;
- summary-card and Navigator hierarchy;
- Practice header/content/footer hierarchy and contained coding geometry;
- compact and mobile composition fixes;
- visual and geometry regression coverage across six approved states.

## Static and Generated Gates

| Gate                                                                 | Result | Evidence                                                                     |
| -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `pnpm format:check`                                                  | PASS   | All checked files use Prettier formatting.                                   |
| `pnpm lint`                                                          | PASS   | ESLint exited with zero warnings and errors.                                 |
| `pnpm typecheck`                                                     | PASS   | TypeScript project references exited successfully.                           |
| `pnpm check:type-strip`                                              | PASS   | 56 TypeScript files passed native type-strip compatibility.                  |
| `node scripts/contracts/check-generated.mjs`                         | PASS   | Generated TypeScript contracts are current.                                  |
| `GO_JSONSCHEMA_BIN=... bash scripts/contracts/check-go-generated.sh` | PASS   | Generated Go contracts are current; generator rerun produced no source diff. |

The Go schema generator emitted its existing warnings for a mixed-type enum and the duplicate `LessonBlock` title. The generated output remained byte-for-byte stable.

## Frontend and Documentation Tests

Exact `pnpm test` result:

| Project group   |  Files |       Tests |
| --------------- | -----: | ----------: |
| Activity DOM    |     14 |       35/35 |
| Workspace DOM 1 |     11 |       34/34 |
| Workspace DOM 2 |     11 |       49/49 |
| Node            |     15 |       48/48 |
| **Total**       | **51** | **166/166** |

Documentation gates:

- `pnpm test:activity-engine-docs`: 2/2 assertions passed.
- `pnpm test:workspace-presentation-docs`: 3/3 assertions passed.

## Production Build

`pnpm build` completed successfully for all workspace packages and the Web application.

The Web bundle produced:

- CSS: `89.42 kB` (`19.00 kB` gzip);
- JavaScript: `666.93 kB` (`201.25 kB` gzip).

Vite emitted its non-failing warning that the JavaScript chunk exceeds the recommended `500 kB` threshold. Bundle splitting remains a separate performance task and is not a Revision 2.1 correctness blocker.

## Go Verification

Exact `pnpm go:verify` exited successfully:

- `gofmt` gate: PASS;
- `go test ./...`: PASS;
- `go vet ./...`: PASS;
- `staticcheck ./...`: PASS.

The required Go tools and modules were retrieved only through the configured internal Artifactory. A temporary file-based proxy was used to stabilize intermittent Artifactory metadata responses; no public registry was used.

## Courses and Embedded Assets

- `pnpm validate:example`: PASS (`course valid`).
- `pnpm validate:multi-domain`: PASS (`course valid`).
- `pnpm go:stage-web`: PASS.
- `pnpm go:verify-web-inventory`: PASS.

The Go-runtime browser binary was rebuilt after staging the verified Web assets.

## Browser Acceptance

Each Playwright suite ran in its own Chromium lifecycle because the runtime environment uses Chromium single-process mode.

| Spec                                         | Result    |
| -------------------------------------------- | --------- |
| `single-active-workspace-go-runtime.spec.ts` | PASS, 1/1 |
| `dual-surface-workspace-runtime.spec.ts`     | PASS, 1/1 |
| `multi-domain-runtime.spec.ts`               | PASS, 1/1 |
| `go-runtime.spec.ts`                         | PASS, 1/1 |

The visual suite verifies:

- aligned panel bottoms;
- assistant dock contained inside the viewport;
- Practice footer following content rather than floating over it;
- visible progress anatomy;
- rendered callout with no raw `[!NOTE]` marker;
- compact title bounds;
- compact assistant containment;
- mobile action geometry;
- exactly one active editable activity renderer.

Six compare-only baselines passed:

1. ordering activity, wide desktop;
2. coding activity, wide desktop;
3. collapsed Practice rail, wide desktop;
4. Navigator drawer at 1366 px;
5. compact workspace;
6. mobile fullscreen Practice.

Snapshots live in `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/`.

## Native Preview

`pnpm go:build-preview` exited successfully for the host preview binary.

This evidence does not claim the optional six-target native release matrix; the verified native scope is the host preview build used by this development checkpoint.

## Result

Revision 2.1 visual fidelity and workspace-height behavior are verified. All required product, static, unit, documentation, build, Go, course, embedded-asset, browser, visual, persistence, and host-preview gates passed on the implementation recorded above.
