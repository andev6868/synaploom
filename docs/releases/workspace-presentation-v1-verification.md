# Workspace Presentation Revision 2 Verification

**Verification date:** 2026-07-20 Asia/Bangkok

**Implementation revision before evidence:** `01bdc4fedcc1e78bcfe6afb0069d5b014d28b9a0`

**Tooling boundary:** pnpm 11.13.0 and Go 1.26.5 resolved through internal Artifactory. No public package registry or public Go proxy was used.

## Result

All mandatory Revision 2 product, static-analysis, unit, documentation, production-build, Go, course-validation, embedded-asset, browser-acceptance, screenshot-comparison, and native-preview gates completed with exit status `0`.

The verified delivery includes the three-zone wide workspace, contained Practice card, fixed Activity Navigator, bounded coding renderer, workspace-level AI dock, four responsive viewport bands, six visual baselines, save-before-switch behavior, SQLite presentation persistence, refresh/restart recovery, and a single editable activity renderer.

## Command evidence

All timestamps are UTC. Add seven hours for Asia/Bangkok.

| Gate                         | Command                                                                                                 | Started                | Finished               | Exit | Evidence                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------- | ---: | ------------------------------------------------------------- |
| Format                       | `pnpm format:check`                                                                                     | `2026-07-20T06:40:43Z` | `2026-07-20T06:40:48Z` |    0 | All files match Prettier.                                     |
| ESLint                       | `pnpm lint`                                                                                             | `2026-07-20T06:40:48Z` | `2026-07-20T06:41:02Z` |    0 | No diagnostics or warnings.                                   |
| TypeScript                   | `pnpm typecheck`                                                                                        | `2026-07-20T06:41:02Z` | `2026-07-20T06:41:08Z` |    0 | Workspace project references compiled.                        |
| Type-strip                   | `pnpm check:type-strip`                                                                                 | `2026-07-20T06:41:08Z` | `2026-07-20T06:41:09Z` |    0 | 56 TypeScript files checked.                                  |
| Contracts                    | `pnpm contracts:check`                                                                                  | `2026-07-20T06:41:09Z` | `2026-07-20T06:41:11Z` |    0 | TypeScript and Go generated contracts matched.                |
| Vitest                       | `pnpm test`                                                                                             | `2026-07-20T06:41:34Z` | `2026-07-20T06:42:03Z` |    0 | 35 DOM files / 112 tests and 15 Node files / 48 tests passed. |
| Activity docs                | `pnpm test:activity-engine-docs`                                                                        | `2026-07-20T06:42:03Z` | `2026-07-20T06:42:04Z` |    0 | 2 assertions passed.                                          |
| Workspace docs               | `pnpm test:workspace-presentation-docs`                                                                 | `2026-07-20T06:42:04Z` | `2026-07-20T06:42:05Z` |    0 | 3 assertions passed.                                          |
| Production build             | `pnpm build`                                                                                            | `2026-07-20T06:42:30Z` | `2026-07-20T06:42:37Z` |    0 | 15 workspace projects built; Vite transformed 1,974 modules.  |
| Go verification              | `pnpm go:verify`                                                                                        | `2026-07-20T06:47:34Z` | `2026-07-20T06:47:39Z` |    0 | gofmt, all Go tests, vet, and staticcheck passed.             |
| Example course               | `pnpm validate:example`                                                                                 | `2026-07-20T06:47:57Z` | `2026-07-20T06:47:59Z` |    0 | Course valid.                                                 |
| Multi-domain course          | `pnpm validate:multi-domain`                                                                            | `2026-07-20T06:47:59Z` | `2026-07-20T06:48:00Z` |    0 | Course valid.                                                 |
| Stage Web                    | `pnpm go:stage-web`                                                                                     | `2026-07-20T06:48:00Z` | `2026-07-20T06:48:06Z` |    0 | Production Web assets staged into Go embed.                   |
| Web inventory                | `pnpm go:verify-web-inventory`                                                                          | `2026-07-20T06:48:06Z` | `2026-07-20T06:48:07Z` |    0 | Embedded inventory matched staged files.                      |
| Revision 2 visual acceptance | `playwright test tests/e2e/single-active-workspace-go-runtime.spec.ts --project=go-runtime --workers=1` | `2026-07-20T06:49:38Z` | `2026-07-20T06:49:53Z` |    0 | 1 flow passed; six screenshot baselines matched.              |
| Persistence/restart          | `playwright test tests/e2e/dual-surface-workspace-runtime.spec.ts --project=go-runtime --workers=1`     | `2026-07-20T06:50:24Z` | `2026-07-20T06:50:33Z` |    0 | 1 flow passed.                                                |
| Multi-domain runtime         | `playwright test tests/e2e/multi-domain-runtime.spec.ts --project=go-runtime --workers=1`               | `2026-07-20T06:51:02Z` | `2026-07-20T06:51:16Z` |    0 | 1 flow passed across all activity kinds and assessment.       |
| Generic Go runtime           | `playwright test tests/e2e/go-runtime.spec.ts --project=go-runtime --workers=1`                         | `2026-07-20T06:51:44Z` | `2026-07-20T06:51:48Z` |    0 | 1 embedded-runtime smoke flow passed.                         |
| Native preview               | `pnpm go:build-preview`                                                                                 | `2026-07-20T06:52:11Z` | `2026-07-20T06:52:13Z` |    0 | Host preview binary built successfully.                       |

## Warnings and boundaries

- Go contract generation emitted the existing mixed-type enum and duplicate `LessonBlock` title warnings; generated hashes remained unchanged.
- Node documentation tests emitted Node's experimental type-stripping warning.
- Vite emitted the existing warning that the main minified JavaScript chunk is larger than 500 kB.
- Browser suites were intentionally run as four independent invocations because the constrained Chromium single-process environment cannot reliably reuse browser contexts across suites.
- The Vitest runner uses two waves of isolated groups with one worker per group. This avoids React scheduler teardown leakage while preserving every test and returning an exact lifecycle exit code.
- Full six-target native release packaging is not claimed by this evidence. The verified native gate is the host preview build; source ZIP and Git bundle verification are recorded separately with the delivered artifacts.
