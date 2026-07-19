# Workspace Presentation v1 Verification

**Release:** Workspace Presentation v1  
**Verification date:** 2026-07-20 Asia/Bangkok (2026-07-19 UTC)  
**Implementation revision before evidence:** `c3ead82`  
**Tooling boundary:** pnpm 11.13.0 and Go 1.26.5 were resolved through the repository's internal toolchain and internal Artifactory cache. No public package registry or public Go proxy was used.

## Result

All required release gates completed with exit status `0`. The verified delivery includes owner-scoped SQLite presentation persistence, optimistic revision handling, save-before-switch behavior, a single editable activity renderer, shared lesson and assessment surfaces, responsive workspace modes, keyboard focus recovery, runtime restart persistence, embedded Web asset inventory, and a native preview smoke test.

## Command evidence

All timestamps are UTC. Add seven hours for Asia/Bangkok.

| Gate                    | Command                                                                         | Started                | Finished               | Exit | Evidence                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- | ---------------------- | ---------------------- | ---: | ------------------------------------------------------------------------------------------- |
| Format                  | `pnpm format:check`                                                             | `2026-07-19T19:54:44Z` | `2026-07-19T19:54:56Z` |  `0` | No Prettier drift.                                                                          |
| ESLint                  | `pnpm lint`                                                                     | `2026-07-19T19:54:56Z` | `2026-07-19T19:55:21Z` |  `0` | No errors or warnings.                                                                      |
| TypeScript              | `pnpm typecheck`                                                                | `2026-07-19T19:55:21Z` | `2026-07-19T19:55:22Z` |  `0` | Workspace project references compiled.                                                      |
| Type-strip              | `pnpm check:type-strip`                                                         | `2026-07-19T19:55:22Z` | `2026-07-19T19:55:23Z` |  `0` | 55 TypeScript files passed compatibility checks.                                            |
| Contracts               | `pnpm contracts:check`                                                          | `2026-07-19T19:55:23Z` | `2026-07-19T19:55:29Z` |  `0` | Generated TypeScript, Go, and embedded schemas matched.                                     |
| Frontend and Node tests | `pnpm test`                                                                     | `2026-07-19T19:45:53Z` | `2026-07-19T19:46:45Z` |  `0` | 47 Vitest files and 145 tests passed: 32 activity DOM, 65 workspace DOM, and 48 Node tests. |
| Activity Engine docs    | `pnpm test:activity-engine-docs`                                                | `2026-07-19T19:46:45Z` | `2026-07-19T19:46:45Z` |  `0` | 2 Node-native assertions passed.                                                            |
| Workspace docs          | `pnpm test:workspace-presentation-docs`                                         | `2026-07-19T19:46:45Z` | `2026-07-19T19:46:46Z` |  `0` | 3 Node-native assertions passed.                                                            |
| Production build        | `pnpm build`                                                                    | `2026-07-19T19:46:46Z` | `2026-07-19T19:46:54Z` |  `0` | 15 workspace projects built; Vite transformed 1,972 modules.                                |
| Go format               | `pnpm go:fmt`                                                                   | `2026-07-19T19:48:05Z` | `2026-07-19T19:48:06Z` |  `0` | No `gofmt` drift.                                                                           |
| Go tests                | `pnpm go:test`                                                                  | `2026-07-19T19:48:06Z` | `2026-07-19T19:48:41Z` |  `0` | 20 tested Go packages passed; 4 command/helper packages had no tests.                       |
| Go vet                  | `pnpm go:vet`                                                                   | `2026-07-19T19:48:41Z` | `2026-07-19T19:48:58Z` |  `0` | No diagnostics.                                                                             |
| Staticcheck             | `pnpm go:staticcheck`                                                           | `2026-07-19T19:48:58Z` | `2026-07-19T19:49:46Z` |  `0` | No diagnostics.                                                                             |
| Example course          | `pnpm validate:example`                                                         | `2026-07-19T19:50:18Z` | `2026-07-19T19:50:20Z` |  `0` | `frontend-performance-foundations` reported `course valid`.                                 |
| Multi-domain course     | `pnpm validate:multi-domain`                                                    | `2026-07-19T19:50:20Z` | `2026-07-19T19:50:23Z` |  `0` | `multi-domain-foundations` reported `course valid`.                                         |
| Stage Web assets        | `pnpm go:stage-web`                                                             | `2026-07-19T19:50:23Z` | `2026-07-19T19:50:31Z` |  `0` | Production Web assets rebuilt and staged.                                                   |
| Web inventory           | `pnpm go:verify-web-inventory`                                                  | `2026-07-19T19:50:31Z` | `2026-07-19T19:50:32Z` |  `0` | Embedded inventory matched staged files.                                                    |
| Browser acceptance      | `pnpm playwright test --project=go-runtime --reporter=line`                     | `2026-07-19T19:50:54Z` | `2026-07-19T19:51:12Z` |  `0` | 3 scenarios passed in 16.2 seconds.                                                         |
| Native preview build    | `pnpm go:build-preview`                                                         | `2026-07-19T19:51:37Z` | `2026-07-19T19:51:40Z` |  `0` | Preview binary built successfully.                                                          |
| Native preview smoke    | Import course, start on port `0`, detect bootstrap URL, send `SIGINT`, and wait | `2026-07-19T19:51:40Z` | `2026-07-19T19:51:41Z` |  `0` | Imported `multi-domain-foundations@1.2.0`, emitted a bootstrap URL, and exited cleanly.     |

The production build emitted the existing Vite chunk-size advisory, and DOM tests emitted the existing KaTeX quirks-mode warning in the test environment. Neither produced a failed gate or browser runtime error.

## Requirement evidence

### SQLite restart persistence

- `TestWorkspacePresentationRepositoryPersistsAndConflicts` verifies create, update, stale revision rejection, and reopening the same database path.
- `TestWorkspacePresentationRepositoryIsolatesOwnerAndProfile` verifies owner and profile isolation.
- `tests/e2e/dual-surface-workspace-runtime.spec.ts` reuses one `SYNAPLOOM_HOME`, restarts the Go process, and verifies presentation state and coding source restoration.

### Optimistic conflict handling

- Repository, domain, and HTTP tests verify expected revision semantics and return the current state on conflict.
- `useLearningWorkspaceController.test.tsx` verifies conflict keeps the mounted state stable and retries the exact original intent with the current backend revision.

### No duplicate editable activity instances

- `InlineActivitySlot.test.tsx` verifies a focused inline slot becomes a read-only summary.
- `LearningWorkspacePage.test.tsx` verifies the focused activity is represented once across Theory and Practice surfaces.
- Browser acceptance counts the focused editor and confirms one editable instance.

### Save-before-switch failure blocking

- `useLearningWorkspaceController.test.tsx` verifies save runs before presentation mutation and blocks focus, collapse, and return-inline when save fails.
- The same suite verifies stale renderer cleanup cannot remove a replacement persistence handle.
- `PracticePanel.test.tsx` verifies dirty file state remains authoritative when persistence rejects.

### Learner collapse precedence

- `TestGetRecoversInvalidFocusAndPreservesLearnerCollapse` verifies persisted learner collapse outranks authored practice defaults.
- Browser acceptance verifies collapsed-but-focused state survives refresh and process restart.

### Shared lesson and assessment shell

- `LearningWorkspacePage.test.tsx` verifies lesson and assessment routes use the same workspace composition.
- `AssessmentWorkspaceContent.test.tsx` verifies assessment policy, progress, score, and requirement footer remain in Theory while focused activities become summaries.
- `multi-domain-runtime.spec.ts` completes all ten Activity Engine v1 kinds and assessment activities through surface-neutral helpers.

### Wide, compact, and mobile behavior

- `LearningWorkspaceShell.test.tsx` verifies wide collapsed/split/expanded mapping, compact local segmented controls, and controlled mobile dialog behavior.
- `useWorkspaceViewport.test.tsx` verifies breakpoint resolution and listener cleanup.
- Viewport mapping does not mutate authoritative persisted presentation state solely because viewport width changed.

### Keyboard focus and recovery

- Controller tests verify focus moves through registered practice and inline headings only after persistence succeeds.
- Save failure leaves focus inside the current editable activity.
- Controlled Dialog and shell tests verify mobile close/focus behavior and accessible surface controls.

### Browser runtime restart flow

`tests/e2e/dual-surface-workspace-runtime.spec.ts` verifies:

1. Open an inline coding activity in Practice Pane.
2. Edit source and collapse the pane.
3. Persist dirty source before editor unmount.
4. Refresh and restore collapsed focused state.
5. Restart the runtime with the same `SYNAPLOOM_HOME`.
6. Reopen the owner and restore presentation state and source from backend storage.

The complete Go-runtime project also verifies generic embedded UI boot and all ten activity kinds across five domains plus assessment.

## Delivery notes

- The legacy `/api/v1/preferences/pane-ratio` compatibility endpoint remains available, but the new workspace does not call it.
- Presentation state and structured events exclude learner answers, essay text, source contents, prompts, and evaluator feedback bodies.
- Node-native documentation specs are excluded from the Vitest Node project and run through dedicated scripts.
- DOM test batches run sequentially with one worker per batch to avoid worker starvation in constrained release environments.
