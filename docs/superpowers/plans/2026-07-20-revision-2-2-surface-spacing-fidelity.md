# Revision 2.2 Surface, Border, and Spacing Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the approved Single Active Workspace with the mockup at pixel-level fidelity for panel proportions, surface backgrounds, border hierarchy, spacing rhythm, radius, and AI dock inset without changing activity behavior.

**Architecture:** Keep the Revision 2.1 three-zone composition and all controller/persistence contracts. Tune visual behavior through shared design tokens, `WorkspaceShell` geometry defaults, component-level spacing rules, and Playwright geometry/screenshot assertions. No business logic or activity renderer API changes are allowed.

**Tech Stack:** React 19, TypeScript 6, CSS, `@synaploom/ui`, Vitest, Testing Library, Playwright, Go embedded runtime.

## Global Constraints

- Preserve one editable activity renderer in the DOM.
- Preserve save-before-switch, split-ratio persistence, optimistic conflict handling, refresh recovery, and process-restart recovery.
- Wide desktop remains `Theory | Practice | Navigator`.
- User-persisted split ratios remain authoritative; only the system default and visual navigator width may change.
- Do not add runtime dependencies.
- Every production change starts with a failing test and ends with focused verification and a commit.

---

### Task 1: Tune wide workspace proportions and shared surface tokens

**Files:**

- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.tsx`
- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.test.tsx`
- Modify: `packages/ui/src/foundations/tokens.css`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `WorkspaceShell` default navigator width of `224px`; neutral canvas/panel/subtle/active surface tokens; one separator border without nested panel borders.

- [x] **Step 1: Add RED unit and browser geometry assertions**

```tsx
expect(screen.getByTestId('workspace-navigator-zone')).toHaveStyle({ width: '224px' });
```

```ts
expect(theoryBox.width / viewport.width).toBeGreaterThanOrEqual(0.44);
expect(theoryBox.width / viewport.width).toBeLessThanOrEqual(0.49);
expect(navigatorBox.width).toBeGreaterThanOrEqual(216);
expect(navigatorBox.width).toBeLessThanOrEqual(240);
```

- [x] **Step 2: Run focused tests and confirm RED**

Run:

```bash
pnpm exec vitest run --project dom packages/ui/src/components/workspace-shell/workspace-shell.test.tsx
```

Expected: FAIL because navigator defaults to `192px`.

- [x] **Step 3: Implement geometry and token changes**

Set `navigatorWidth = 224`. Add workspace-specific aliases for canvas, panel, subtle, active, and border levels. Remove the outer Practice panel border and retain one neutral card border plus one neutral split separator.

- [x] **Step 4: Verify and commit**

Run UI tests, typecheck, lint, and the wide geometry assertions. Commit:

```bash
git commit -m "style: tune workspace proportions and surfaces"
```

### Task 2: Tighten Theory and activity-summary spacing rhythm

**Files:**

- Modify: `apps/web/src/application.css`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `24–32px` Theory section gaps, `8–12px` paragraph gaps, compact progress card, `16px` activity-card padding, and consistent card/button alignment.

- [x] **Step 1: Add RED anatomy and geometry assertions**

Require the lesson article stack to use a bounded reading measure, progress summary height below `96px`, activity summary vertical padding of `16px`, and consecutive lesson sections no farther than `40px` apart.

- [x] **Step 2: Confirm RED on current spacing**

Run page and summary-card focused tests plus the ordering-wide browser state.

- [x] **Step 3: Implement spacing scale**

Normalize Markdown margins inside `.syn-lesson-panel__article`, reduce page/article bottom padding, compact heading/progress spacing, and align summary-card icon/content/CTA gaps to the approved mockup.

- [x] **Step 4: Verify and commit**

Run focused tests, lint, typecheck, and browser geometry. Commit:

```bash
git commit -m "style: tighten theory and activity spacing"
```

### Task 3: Refine Practice and Navigator border hierarchy

**Files:**

- Modify: `apps/web/src/application.css`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticeActivityNavigator.test.tsx`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: one Practice card border, `12–16px` Practice gutter, `16–20px` header/footer padding, lighter Navigator active state, `12px` Navigator item padding, and consistent radii.

- [x] **Step 1: Add RED class/geometry assertions**

Assert the Practice outer zone is borderless, card padding from separator is at least `12px`, footer action gap is `8px`, active Navigator item has a single `1px` border, and inactive items remain neutral.

- [x] **Step 2: Confirm RED**

Run Practice/Navigator tests and coding-wide browser state.

- [x] **Step 3: Implement border and spacing hierarchy**

Use neutral borders for normal surfaces, one subtle blue border for active states, remove inset blue bars, standardize card radius to `10px`, main surfaces to `12px`, and rebalance Practice header/footer spacing.

- [x] **Step 4: Verify and commit**

Run focused tests, lint, typecheck, and coding-wide screenshot comparison. Commit:

```bash
git commit -m "style: refine practice and navigator chrome"
```

### Task 4: Inset the AI dock and refresh visual baselines

**Files:**

- Modify: `apps/web/src/application.css`
- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.test.tsx`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/*.png`
- Modify: `docs/verification/single-active-workspace.md`

**Interfaces:**

- Produces: assistant dock inset `16–24px`, bottom margin `8–12px`, height `56–64px`, `12px` radius, and subtle two-layer shadow.

- [x] **Step 1: Add RED dock geometry assertions**

```ts
expect(dockBox.x).toBeGreaterThanOrEqual(16);
expect(viewport.width - dockBox.x - dockBox.width).toBeGreaterThanOrEqual(16);
expect(dockBox.height).toBeGreaterThanOrEqual(56);
expect(dockBox.height).toBeLessThanOrEqual(64);
```

- [x] **Step 2: Confirm RED against current edge-to-edge dock**

Run the focused assistant test and visual runtime spec without updating snapshots.

- [x] **Step 3: Implement dock inset and update six baselines**

Inset the assistant wrapper, use a complete `12px` radius, neutral border, and subtle shadow. Regenerate ordering-wide, coding-wide, collapsed-wide, 1366 navigator, compact, and mobile baselines only after all geometry assertions pass.

- [x] **Step 4: Run full verification**

Run format, lint, typecheck, exact frontend tests, production build, Go verify, course validation, embedded asset inventory, browser suites, and native preview build.

- [x] **Step 5: Update evidence, commit, and package**

Record commands and counts, commit Revision 2.2, create source ZIP plus full Git bundle, clone-verify the bundle, compare tree/archive hashes, check ZIP CRC, and generate SHA-256 files.
