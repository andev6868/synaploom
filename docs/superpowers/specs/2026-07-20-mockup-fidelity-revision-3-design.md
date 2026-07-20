# Synaploom Mockup Fidelity Revision 3 Design

**Status:** Approved
**Date:** 2026-07-20
**Target:** Single Active Workspace desktop fidelity and responsive regression safety
**Checkpoint:** `synaploom-revision2-final-with-git(1).zip`
**Baseline commit:** `e4d14c0`
**Supersedes:** Visual-composition and spacing assumptions from Revision 2.1 and Revision 2.2 where they conflict with the approved mockup

## 1. Decision

Revision 3 adopts a combined fidelity contract:

- the canonical desktop viewport is **1672 × 941 CSS pixels** at device scale factor `1`;
- the canonical desktop state must be visually close to the approved mockup, with structural geometry treated as a contract rather than an approximation;
- existing responsive behavior remains supported at `1600 × 900`, `1366 × 768`, compact, and mobile viewports;
- implementation will use **bounded component anatomy changes plus CSS consolidation**, not another terminal override layer and not a rewrite of the activity engine.

The approved mockup is authoritative for desktop composition, hierarchy, state presentation, spacing rhythm, surface containment, and relative visual weight.

## 2. Canonical acceptance state

Visual acceptance at `1672 × 941` uses a deterministic state:

```text
Pane mode:      split
Focused:        Sắp xếp thuật toán
Activity 1:     đang làm, đã lưu bản nháp
Activity 2:     chưa mở
Ordering:       Đọc hai số a và b → Hiển thị kết quả → Tính a + b
Theory scroll:  top
Navigator:      permanent
AI dock:        visible
```

The test setup must create this state explicitly. It must not rely on local storage, draft data, timestamps, or completion state left by a previous test run.

`Chưa mở` is a presentation label for an activity that has not yet been opened in the current learning workspace. Revision 3 does not add a new persisted activity lifecycle state.

## 3. Goals

Revision 3 must:

- eliminate the major structural mismatches identified in the runtime-to-mockup comparison;
- reach at least **90% visual similarity** at the canonical viewport after dynamic regions are stabilized;
- keep anchor geometry within **2–4 CSS pixels** for the header, Theory bounds, Practice bounds, Navigator bounds, and AI dock bounds;
- preserve all Single Active Workspace behavioral guarantees;
- leave responsive layouts usable and covered by runtime snapshots;
- reduce CSS cascade debt by making one authoritative rule set own each affected component.

## 4. Non-goals

Revision 3 will not:

- rewrite the activity engine or learning workspace controller;
- change API contracts, database schema, course schema, or persisted progression semantics;
- introduce an activity-locking domain model;
- add runtime dependencies;
- implement native pointer drag-and-drop for ordering activities;
- redesign the full Synaploom design system;
- alter course progression or assessment rules.

## 5. Header design

The desktop header must match the mockup hierarchy:

```text
Brand | divider | Chapter breadcrumb → Lesson breadcrumb | previous | next | Nội dung | environment | profile
```

Required behavior:

- align the brand and navigation controls to the canonical header height;
- render a visible divider immediately after the brand region;
- preserve `Chương` and `Bài học` labels while presenting them as one navigation hierarchy;
- keep previous, next, and `Nội dung` controls grouped near the lesson context rather than stretched across the header;
- remove visual indicators that are not part of the approved header;
- render the trailing profile surface shown in the mockup;
- preserve keyboard navigation, disabled state, and accessible labels.

## 6. Workspace geometry

### 6.1 Wide desktop

At viewports `≥ 1440px`, the workspace remains:

```text
Theory | Practice Workspace | gutter | Activity Navigator
```

Canonical proportions after shell padding:

- Theory: approximately `46%`;
- Practice: approximately `37%`;
- Navigator: approximately `13–14%`;
- a distinct gutter separates Practice from Navigator;
- all three zones terminate above the contextual AI dock on one shared baseline.

The persisted split ratio remains authoritative after the user changes it. Revision 3 may adjust only the default ratio and the constraints needed to match the approved first-load state.

### 6.2 Intermediate and mobile layouts

Existing responsive contracts remain:

- `1180–1439px`: Theory and Practice split; Navigator opens as a designed drawer or popover;
- `720–1179px`: compact split layout;
- `< 720px`: Practice opens as a full-screen dialog or equivalent mobile surface.

Desktop fixes must not force permanent Navigator width or AI dock geometry onto these layouts.

## 7. Theory panel

Theory must use the width available in its zone rather than a narrowly centered reading column that creates excessive side whitespace.

Required composition:

1. learning-state pill;
2. title and concise introduction;
3. progress card aligned with the heading region;
4. lesson prose and table;
5. first activity summary;
6. second activity summary;
7. supporting lesson content;
8. completion requirements.

Required visual behavior:

- horizontal padding and content measure match the mockup closely at `1672 × 941`;
- vertical gaps between title, introduction, prose, table, and cards are compact enough that both activity summaries are visible in the canonical viewport;
- the progress card matches the approved relative width, height, and title alignment;
- the focused summary uses a restrained active surface and compact icon treatment;
- the inactive summary remains visible directly after the focused summary;
- the canonical example fixture places the note after the second activity so the two activity summaries remain consecutive, matching the approved mockup; this is an authoring-fixture correction, not a renderer rule that reorders arbitrary lesson content.

## 8. Practice Workspace

### 8.1 Surface anatomy

Practice must use one primary bordered surface:

```text
Practice Workspace Card
├── Header
├── Content viewport
│   ├── primary instruction
│   ├── supporting drag instruction
│   └── ordering items
└── Footer
```

The implementation must remove the extra gray canvas plus nested white content card that creates a double-container appearance.

### 8.2 Header

The header contains:

- activity ordinal such as `1/2`;
- activity title;
- active status;
- draft/save status;
- collapse control;
- `Danh sách hoạt động` control at viewports where it is required by the approved composition.

The canonical state presents `Đang làm` and `Đã lưu bản nháp`; it does not present `Đã đạt`.

### 8.3 Ordering content

Ordering items must:

- show a six-dot drag affordance at the left;
- preserve keyboard-accessible move-up and move-down controls;
- use mockup-aligned height, padding, radius, and vertical gaps;
- render the deterministic incorrect order used by the canonical state;
- expose a supporting instruction explaining that the learner can drag and drop to reorder.

The drag affordance is visual in Revision 3. Pointer drag behavior is excluded unless an existing renderer contract already supplies it without expanding scope.

### 8.4 Footer

The canonical footer contains:

- deterministic last-saved text including a stabilized time;
- `Lưu bản nháp`;
- `Kiểm tra đáp án`.

`Hoạt động tiếp theo` is not shown before the current activity passes. Save errors and retry behavior remain unchanged.

## 9. Activity Navigator

The permanent wide-desktop Navigator must:

- include the header chevron shown by the mockup;
- present activity 1 as `Đang làm`;
- present activity 2 as `Chưa mở` in the canonical state;
- use a light active border and restrained active fill;
- use a neutral inactive surface and clear ordinal circle;
- preserve status meaning without relying on color alone;
- keep the footer guidance visually quiet and avoid an unnecessarily strong separator.

The Activity Tray and drawer variants must reuse the same status mapping and item anatomy.

## 10. AI dock

At the canonical desktop viewport, the contextual assistant is a centered floating dock:

- approximately `73%` of viewport width;
- inset from both horizontal edges and from the bottom;
- one row only;
- `Trợ lý AI` label, lesson-level input, send control, and quick actions share one horizontal composition;
- no second visible context row is rendered;
- the placeholder refers to the lesson, matching the mockup;
- the send control uses a square muted surface rather than a circular primary surface.

The focused activity context may still be included in the assistant request payload. Hiding the extra context row is a presentation change, not a data-flow change.

## 11. CSS ownership and cleanup

Revision 3 must not append a new catch-all override block to `apps/web/src/application.css`.

For each affected component:

1. identify the final rule currently winning the cascade;
2. move the accepted values into one authoritative section;
3. delete superseded Revision 2.1/2.2 declarations that target the same state and breakpoint;
4. keep breakpoint-specific rules adjacent to the base component rules;
5. use workspace-scoped tokens for canvas, panel, subtle active fill, border, spacing, and dock geometry;
6. avoid changing global button or typography defaults for a workspace-only correction.

## 12. Testing strategy

### 12.1 Component tests

Component tests cover stable anatomy and state mapping:

- header divider, breadcrumb hierarchy, profile surface, and navigation controls;
- Theory summary ordering and active/inactive content;
- Practice header controls and canonical status labels;
- ordering drag affordance plus keyboard controls;
- footer action visibility before passing;
- Navigator status mapping and chevron;
- AI dock single-row presentation and lesson-level placeholder.

Tests must prefer semantic queries and stable `data-testid` anchors only where geometry assertions require them.

### 12.2 Browser geometry tests

At `1672 × 941`, Playwright asserts:

- header height and principal control positions;
- Theory, Practice, Navigator, and gutter bounds;
- Theory content left/right padding and progress-card bounds;
- Practice single-surface containment;
- ordering row height and spacing;
- AI dock width, center alignment, bottom inset, and height;
- no element marked `data-active-activity-editor` appears more than once.

Anchor tolerance is `2–4px`, depending on whether the measurement crosses font-rendered content.

### 12.3 Visual baselines

Maintain:

1. a canonical `1672 × 941` ordering baseline matching the approved mockup state;
2. runtime regression snapshots for ordering wide, coding wide, collapsed wide, `1366`, compact, and mobile layouts.

Timestamps, random identifiers, animations, transitions, and persistence state must be stabilized before screenshot capture.

### 12.4 Behavioral regression

The following must remain green:

- one live editor;
- save-before-switch;
- failed-save retry and focus preservation;
- draft persistence;
- split-ratio persistence;
- collapse and restore;
- intermediate-width Navigator drawer;
- mobile Practice dialog;
- coding activity containment;
- keyboard operation;
- reduced-motion behavior.

## 13. Acceptance criteria

Revision 3 is complete only when:

- the canonical screenshot has no P0 structural mismatch;
- calculated visual similarity is at least `90%` after stable normalization;
- primary anchor geometry is within the documented tolerance;
- all responsive snapshots are reviewed and approved;
- focused component tests, frontend verification, Go embedded runtime tests, and production build pass;
- CSS duplicate-rule review confirms that affected component states have one authoritative owner;
- verification evidence records commands, snapshot names, and resulting commit.
