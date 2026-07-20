# Single Active Workspace Revision 2.2 Verification

**Verification date:** 2026-07-20  
**Verified implementation commit:** `d553e36`  
**Branch:** `work/single-active-workspace-r21-visual-fidelity`

## Scope

Revision 2.2 closes the remaining mockup-fidelity gaps for workspace proportions, backgrounds, border hierarchy, spacing rhythm, radius, and assistant-dock inset. It does not change activity lifecycle, persistence, save-before-switch, optimistic conflict handling, or single-editor behavior.

The verified changes cover:

- a `224px` default Activity Navigator and `216–240px` responsive wide range;
- neutral canvas, panel, subtle, and active surface tokens;
- one Practice card border instead of nested/double borders;
- tighter Theory paragraph, equation, section, progress, and activity-card rhythm;
- balanced Practice header/content/footer gutters and action gaps;
- lighter Navigator active treatment without an inset blue bar;
- a fully inset `60px` contextual AI dock with a complete radius and subtle two-layer shadow;
- refreshed visual baselines for all six approved responsive states.

## Static Gates

| Gate                    | Result | Evidence                                                    |
| ----------------------- | ------ | ----------------------------------------------------------- |
| `pnpm format:check`     | PASS   | All repository files match Prettier formatting.             |
| `pnpm lint`             | PASS   | ESLint exited with zero warnings and errors.                |
| `pnpm typecheck`        | PASS   | TypeScript project references exited successfully.          |
| `pnpm check:type-strip` | PASS   | 56 TypeScript files passed native type-strip compatibility. |
| `git diff --check`      | PASS   | No whitespace errors.                                       |

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

- CSS: `93.08 kB` (`19.43 kB` gzip);
- JavaScript: `667.11 kB` (`201.31 kB` gzip).

Vite emitted its existing non-failing warning that the JavaScript chunk exceeds the recommended `500 kB` threshold. Bundle splitting remains a separate performance task.

## Go Verification

Exact `pnpm go:verify` exited successfully:

- `gofmt` gate: PASS;
- `go test ./...`: PASS;
- `go vet ./...`: PASS;
- `staticcheck ./...`: PASS.

## Courses and Embedded Assets

- `pnpm course:validate examples/frontend-performance-foundations`: PASS (`course valid`).
- `pnpm course:validate examples/multi-domain-foundations`: PASS (`course valid`).
- `pnpm go:stage-web`: PASS.
- `pnpm go:verify-web-inventory`: PASS.

The Go-runtime binary was rebuilt after staging the Revision 2.2 Web assets.

## Browser Acceptance

Each Playwright suite ran in its own Chromium lifecycle.

| Spec                                         | Result    |
| -------------------------------------------- | --------- |
| `single-active-workspace-go-runtime.spec.ts` | PASS, 1/1 |
| `dual-surface-workspace-runtime.spec.ts`     | PASS, 1/1 |
| `multi-domain-runtime.spec.ts`               | PASS, 1/1 |
| `go-runtime.spec.ts`                         | PASS, 1/1 |

The visual suite additionally verifies:

- Theory occupies `44–49%` of the full wide viewport;
- Navigator width remains in the `216–240px` range;
- Practice has one contained card and aligned footer;
- assistant dock has at least `16px` left/right inset and a `56–64px` height;
- six compare-only baselines match exactly.

Snapshots live in `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/`.

## Native Preview

`pnpm go:build-preview` exited successfully for the host preview binary.

## Result

Revision 2.2 surface, border, spacing, proportion, and assistant-dock fidelity are verified. Product behavior and persistence regressions remain green.
