# Single Active Workspace UI Revision 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose Synaploom’s Single Active Workspace so wide desktop renders a readable Theory zone, a contained Practice Workspace Card, and a separate Activity Navigator while preserving one-editor, save-before-switch, persistence, responsive, and accessibility behavior.

**Architecture:** Keep the existing controller, persistence, status API, and activity attempt lifecycle. Add an explicit four-band viewport model, extend the design-system workspace shell with an optional fixed navigator sibling, turn Practice into a header/content/footer card, and give `ActivityHost` an explicit `practice-contained` surface so activity renderers cannot control shell geometry. Hoist the AI assistant to workspace level and verify the result with structural geometry assertions plus six Playwright screenshot baselines.

**Tech Stack:** React 19, TypeScript 6, `react-resizable-panels` 4, TanStack Query, Vitest + Testing Library, Playwright, Go runtime with embedded Vite assets, pnpm 11.13.0.

## Global Constraints

- Exactly one element marked `data-active-activity-editor` may exist in the DOM.
- Every authored activity position in Theory is a read-only summary card.
- At `>=1440px`, desktop renders `Theory | Practice Workspace Card | Activity Navigator` as sibling zones.
- At `1180–1439px`, desktop renders `Theory | Practice` and opens activity navigation in a designed drawer/popover.
- Practice owns card geometry, header, content scrolling, save/error state, and action footer.
- The learning workspace always renders `ActivityHost` with `surface="practice-contained"`.
- Coding dark surfaces remain bounded inside the Practice content region.
- AI assistance is composed at workspace level and names lesson or activity context.
- Theory and Practice scroll independently; wrappers use `min-height: 0`, `min-width: 0`, and `overflow: hidden`.
- Save failure blocks switching and keeps the current editor mounted.
- Focus, pane mode, split ratio, and drafts survive refresh and runtime restart.
- Use test-first development and one focused commit per task.

---

### Task 1: Introduce four viewport presentation bands

**Files:**
- Modify: `apps/web/src/features/learning-workspace/useWorkspaceViewport.ts`
- Modify: `apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/workspace-events.ts`
- Modify: `apps/web/src/features/learning-workspace/workspace-events.test.ts`

**Interfaces:**
- Produces: `type WorkspaceViewport = 'wide-three' | 'wide-two' | 'compact' | 'mobile'`.
- Breakpoints: `wide-three >= 1440`, `wide-two >= 1180`, `compact >= 720`, otherwise mobile.

- [ ] Write tests that map 1600→`wide-three`, 1366→`wide-two`, 900→`compact`, and 390→`mobile`.
- [ ] Run `pnpm exec vitest run --project dom apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx apps/web/src/features/learning-workspace/workspace-events.test.ts` and confirm RED because the old union only exposes `wide`.
- [ ] Replace media queries with `'(min-width: 1440px)'`, `'(min-width: 1180px)'`, and `'(min-width: 720px)'`; subscribe to all three queries and update event types.
- [ ] Re-run the focused tests and `pnpm --filter @synaploom/web typecheck`; expect PASS.
- [ ] Commit `feat: add revision two viewport bands`.

### Task 2: Create the dedicated Practice Activity Navigator

**Files:**
- Create: `apps/web/src/features/learning-workspace/PracticeActivityNavigator.tsx`
- Create: `apps/web/src/features/learning-workspace/PracticeActivityNavigator.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivityTray.tsx`

**Interfaces:**
```ts
export interface PracticeActivityNavigatorProps {
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => Promise<void>;
  readonly onSelectionComplete?: () => void;
}
```

- [ ] Write tests for authored order, ordinal, textual status, `aria-current="true"`, and close-after-success but not close-after-save-failure.
- [ ] Confirm RED because the component does not exist.
- [ ] Implement a semantic `<nav aria-label="Danh sách hoạt động">` using shared buttons; selection awaits `onSelectActivity` before invoking `onSelectionComplete`.
- [ ] Keep `ActivityTray` as a compatibility wrapper delegating to the navigator model; remove native `<details>` usage from consumers in later tasks.
- [ ] Run focused tests and typecheck; commit `feat: add practice activity navigator`.

### Task 3: Extend the design-system WorkspaceShell to three zones

**Files:**
- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.tsx`
- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.test.tsx`
- Modify: `packages/ui/src/styles.css`

**Interfaces:**
```ts
export interface WorkspaceShellProps {
  readonly lesson: ReactNode;
  readonly practice: ReactNode;
  readonly navigator?: ReactNode;
  readonly navigatorWidth?: number;
  readonly defaultLessonRatio?: number;
  readonly onLessonSizeChange?: (ratio: number) => void;
}
```

- [ ] Write tests that the navigator is a sibling after the resizable group, has `data-workspace-navigator-zone`, and buttons inside remain enabled.
- [ ] Confirm RED.
- [ ] Wrap the resizable Theory/Practice group and optional fixed `<aside>` in `.syn-workspace-frame`; never pass `disabled` to the navigator subtree.
- [ ] Ensure persisted ratio still describes only Theory versus Practice and the navigator width is excluded.
- [ ] Run UI tests/typecheck and commit `feat: support three-zone workspace shell`.

### Task 4: Compose wide-three, wide-two, compact, and mobile surfaces

**Files:**
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
- Add props `navigator: ReactNode` and `assistant: ReactNode` to `LearningWorkspaceShellProps`.
- `wide-three`: pass navigator to `WorkspaceShell`.
- `wide-two`: omit permanent navigator and expose controlled drawer opened from Practice.
- `compact`: segmented Theory/Practice surfaces with navigator drawer.
- `mobile`: full-screen Practice dialog with navigator inside.

- [ ] Write tests for three sibling zones at wide-three, no permanent empty navigator at wide-two, exactly one Practice mount at compact/mobile, and assistant outside Theory.
- [ ] Confirm RED.
- [ ] Hoist `AssistantPanel` out of `.syn-lesson-panel` in lesson and assessment compositions and pass it to the shell.
- [ ] Implement controlled navigator surface state in the shell without persisting transient drawer visibility.
- [ ] Run focused tests/typecheck and commit `feat: compose revision two workspace surfaces`.

### Task 5: Turn PracticePane into a contained workspace card

**Files:**
- Modify: `apps/web/src/features/learning-workspace/PracticePane.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
```ts
export interface PracticePaneProps {
  // existing fields
  readonly navigatorVisible: boolean;
  readonly onToggleNavigator: () => void;
}
```

- [ ] Write tests for card anatomy `header → content viewport → footer`, designed navigator control, save state in header/footer, and a single `data-active-activity-editor` wrapper.
- [ ] Confirm RED against the existing flex pane/native details structure.
- [ ] Implement `.syn-practice-workspace-card` as `grid-template-rows: auto minmax(0,1fr) auto`; put instructions/renderer/feedback in the scrollable content region.
- [ ] Expose an action outlet so renderer actions render in the shared footer.
- [ ] Run Practice tests/typecheck and commit `feat: add contained practice workspace card`.

### Task 6: Add the ActivityHost presentation-surface contract

**Files:**
- Modify: `apps/web/src/features/activity-engine/types.ts`
- Modify: `apps/web/src/features/activity-engine/ActivityHost.tsx`
- Modify: `apps/web/src/features/activity-engine/ActivityHost.test.tsx`
- Modify: activity renderer props under `apps/web/src/features/activity-engine/renderers/`

**Interfaces:**
```ts
export type ActivityHostSurface = 'practice-contained' | 'standalone';
export interface ActivityActionOutlet {
  readonly setActions: (actions: ReactNode | null) => void;
}
```

- [ ] Write tests that Practice passes `practice-contained`, standalone remains the default for legacy callers, and contained actions can be projected to the shell footer.
- [ ] Confirm RED.
- [ ] Thread `surface` and optional `actionOutlet` through `ActivityHost` and renderers without altering attempt persistence.
- [ ] Run all ActivityHost/renderer tests and typecheck; commit `feat: add contained activity host surface`.

### Task 7: Contain the coding renderer

**Files:**
- Modify: `apps/web/src/features/activity-engine/renderers/CodingActivity.tsx`
- Modify: `apps/web/src/features/activity-engine/renderers/CodingActivity.test.tsx`
- Modify: `apps/web/src/features/coding-practice/PracticePanel.tsx`
- Modify: `apps/web/src/features/coding-practice/PracticePanel.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
- `PracticePanel` accepts `surface: 'practice-contained' | 'standalone'` and optional action outlet.

- [ ] Write tests that contained coding uses a bounded class, projects save/run/check actions into the Practice footer, and standalone preserves its current internal action bar.
- [ ] Confirm RED.
- [ ] Implement a bounded internal grid with editor primary and terminal/result capped; remove `height:100%` from contained mode.
- [ ] Keep editor, terminal, and result internal scroll regions keyboard reachable.
- [ ] Run coding/practice tests, typecheck, and build; commit `feat: contain coding workspace renderer`.

### Task 8: Apply the approved visual hierarchy

**Files:**
- Modify: `apps/web/src/features/learning-workspace/ActivitySummaryCard.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.test.tsx`
- Modify: `apps/web/src/application.css`
- Modify: `packages/ui/src/styles.css`

- [ ] Write anatomy tests for summary icon/title/status/description/CTA, compact AI context dock, and active/inactive navigator items.
- [ ] Confirm RED where required elements/classes are missing.
- [ ] Implement the 8px-derived spacing, restrained active summary, inset Practice zone, card radius/border, 176–224px navigator, and 52–64px AI dock.
- [ ] Preserve shared button components and textual status semantics.
- [ ] Run focused tests, lint, typecheck, and production web build; commit `style: align revision two visual hierarchy`.

### Task 9: Add geometry and visual-regression acceptance

**Files:**
- Create: `tests/e2e/single-active-workspace-go-runtime.spec.ts`
- Create: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/*.png`
- Modify: `tests/e2e/dual-surface-workspace-runtime.spec.ts`
- Modify: `tests/e2e/multi-domain-runtime.spec.ts`
- Modify: `internal/workspacepresentation/service.go`
- Modify: `internal/workspacepresentation/service_test.go`
- Modify: `apps/web/src/application.css`

- [ ] Add geometry assertions for wide-three sibling zones, inset card, bounded coding surface, fixed header/footer, independent Theory/Practice scroll, one active editor, 56px collapsed rail, 1366 drawer, compact switching, and mobile fullscreen bounds.
- [ ] Run against staged Go assets and confirm RED on the current two-zone composition.
- [ ] Set system default split ratio to `0.52` so Theory occupies 44–48% after the navigator is added; retain persisted user ratios.
- [ ] Fix any measured height-chain regressions at the source; do not add document-level scrolling.
- [ ] Generate and visually review six baselines: ordering wide, coding wide, collapsed wide, 1366 navigator, compact, mobile.
- [ ] Run visual compare-only plus persistence/restart and multi-domain suites; commit `test: verify revision two workspace composition`.

### Task 10: Final verification, evidence, and packaging

**Files:**
- Modify: `tooling/test-config/setup-dom.ts` only if React scheduler teardown requires a verified cleanup tick.
- Modify: `scripts/test/run-vitest-batches.mjs` only if exact `pnpm test` cannot exit cleanly.
- Modify: `docs/releases/workspace-presentation-v1-verification.md`
- Modify: `docs/superpowers/plans/2026-07-20-single-active-workspace-ui-revision-2.md`

- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm check:type-strip`, and `pnpm contracts:check`; all must exit 0.
- [ ] Run exact `pnpm test`, both documentation suites, and `pnpm build`; record file/test counts and warnings.
- [ ] Run `pnpm go:verify`, both course validators, `pnpm go:stage-web`, and `pnpm go:verify-web-inventory`.
- [ ] Run each Go-runtime Playwright suite with an independent browser lifecycle when Chromium single-process cannot reuse contexts; all assertions and screenshot comparisons must pass.
- [ ] Run `pnpm go:build-preview`; record native multi-target release as blocked only if the environment cannot finish cross-compilation, never as a false PASS.
- [ ] Update evidence with exact commands/results, mark all completed plan checkboxes, run `git diff --check`, and commit `docs: record revision two workspace verification`.
- [ ] Export source from `git archive HEAD`, create a full Git bundle, clone-verify the bundle tree, check ZIP CRC, and emit SHA-256 files.
