# Single Active Workspace UI Design — Revision 2

**Status:** Approved
**Date:** 2026-07-20
**Revision:** 2 — corrected after runtime-to-mockup audit
**Target:** Synaploom learning workspace visual composition
**Supersedes:** Revision 1 of this document and the visual-composition assumptions in `2026-07-20-single-active-workspace-ui.md`

## 1. Decision

Synaploom keeps the **Single Active Workspace** interaction model, but the desktop implementation must use a deliberate **three-zone composition** rather than stretching the Practice renderer across the entire right half of the application.

At any moment, exactly one activity may expose editable controls. The focused activity is mounted only inside the Practice Workspace Card. Its authored location inside Theory remains a read-only summary card.

![Approved Single Active Workspace mockup](./assets/2026-07-20-single-active-workspace-approved.png)

The approved mockup is now authoritative for composition, hierarchy, containment, and relative visual weight. Minor typography and token-level differences are acceptable; omitting a zone or allowing an activity renderer to redefine the shell is not acceptable.

## 2. Why Revision 2 is required

The first implementation achieved the one-editor behavior but did not reproduce the approved visual architecture. The runtime audit found these structural mismatches:

- desktop rendered only `Theory | Practice`, while the approved design requires `Theory | Practice Workspace | Activity Navigator`;
- the coding renderer inherited a full-height standalone layout and expanded its dark surface across most of the pane;
- Practice controls, activity navigation, activity content, and actions were not composed as one card;
- the native `<details>` tray exposed browser-default UI instead of a designed navigator;
- the AI assistant remained nested under Theory instead of belonging to the workspace shell;
- visual tests asserted class names and behavior but did not verify geometry or screenshot composition.

Revision 2 corrects the composition contract while preserving the existing controller, persistence, save-before-switch transaction, and one-editor invariant.

## 3. Product goals

The revised workspace must:

- provide one predictable place for active work;
- prevent duplicate editors and competing calls to action;
- keep Theory readable while Practice is active;
- make Practice feel like a contained workspace card, not a second embedded application;
- keep activity navigation visible without consuming a blank column;
- make ordering, coding, writing, quiz, matching, and assessment activities share the same outer shell;
- preserve independent scrolling, persisted presentation state, and save-before-switch behavior;
- match the approved visual hierarchy closely enough that ordering and coding screenshots clearly look like the same product.

## 4. Core interaction contract

### 4.1 One live editor

Only the focused activity host inside the Practice Workspace Card may mount editable controls.

Theory must never mount:

- answer inputs;
- code editors;
- drag handles;
- terminals;
- evaluation controls;
- activity-specific editing widgets.

Exactly one element marked `data-active-activity-editor` may exist in the DOM.

### 4.2 Theory activity summaries

Every authored activity position renders a summary card containing:

- an activity-kind icon;
- title;
- textual status with icon or dot;
- a one-line description or focused-state message;
- one navigation action.

Focused example:

```text
Sắp xếp thuật toán
Đang làm · Đã lưu bản nháp
Activity đang mở trong khu vực thực hành.

[Quay lại thực hành]
```

Non-focused example:

```text
Viết chương trình tính tổng
Chưa bắt đầu
Viết chương trình tính tổng.

[Thực hành bài này]
```

The active summary may use a light blue background and blue border, but it must remain visually subordinate to the Practice Workspace Card.

### 4.3 Switching activity

Selecting another activity performs one transaction:

```text
save focused activity if dirty
→ stop and preserve current UI if save fails
→ persist the new focused activity
→ mount the selected activity once
→ update navigator active state
→ scroll Theory summary into view when appropriate
→ move keyboard focus to the Practice heading
```

### 4.4 Collapsing Practice

Collapsing hides the Practice Workspace Card while preserving focused activity, draft, and layout state.

On wide desktop, the Practice area becomes a 52–56 px rail. It must not leave a blank content column. Restoring the rail reopens the same activity.

There is no return-inline editor state.

## 5. Wide desktop composition

### 5.1 Three-zone layout

For viewports at or above 1440 CSS pixels, the main workspace is:

```text
Theory Pane | Practice Workspace Card | Activity Navigator
```

Recommended allocation after gutters:

- **Theory Pane:** 44–48%;
- **Practice Workspace:** 36–40%;
- **Activity Navigator:** 12–14%;
- **gutter/divider:** 12–24 px between zones.

The exact ratio may respond to the persisted split preference, but all three zones must remain usable. The Activity Navigator is not counted as part of the Practice card width.

Minimum widths:

- Theory content surface: 560 px;
- Practice Workspace Card: 480 px;
- Activity Navigator: 176 px.

If the viewport cannot satisfy those minima, the navigator changes presentation rather than squeezing the editor below usable width.

### 5.2 Desktop between 1180 and 1439 px

Use a two-zone `Theory | Practice Workspace` split. The Activity Navigator becomes a designed popover or anchored drawer opened by `Danh sách hoạt động` in the Practice header.

The navigator must not remain as an empty permanent column.

### 5.3 Geometry ownership

The application shell owns viewport height. The learning workspace owns the remaining height below global navigation and above the contextual AI dock.

Each zone must use:

```css
min-height: 0;
min-width: 0;
overflow: hidden;
```

Only designated internal scroll viewports may scroll. Content must not expand a parent to document height.

## 6. Theory Pane design

### 6.1 Structure

Theory contains:

1. learning-state pill;
2. lesson title and concise introduction;
3. progress card aligned with the heading region;
4. lesson prose and reference material;
5. activity summary cards at authored positions;
6. completion requirements and progression actions.

### 6.2 Reading measure

The scroll viewport may fill the Theory zone, but prose uses a bounded reading column. The content column should normally remain between 680 and 820 px, centered within its zone when space allows.

Opening, changing, or collapsing Practice must not cause large typography reflow beyond the intentional zone-width change.

### 6.3 Activity summary card anatomy

```text
[Icon]  Title                         [CTA]
        Status icon + status text
        Description or focused message
```

Required visual behavior:

- 12–16 px internal padding;
- 10–12 px radius;
- quiet neutral background for inactive cards;
- restrained blue treatment for the active card;
- CTA uses the standard button system, not unstyled HTML text;
- status never relies on color alone.

## 7. Practice Workspace Card

### 7.1 Outer surface

The Practice zone uses a neutral page background with 12–16 px padding. Inside it sits one bordered card that fills the available zone height.

The card must have:

- white or near-white shell surface;
- 10–14 px corner radius;
- subtle border and optional low-elevation shadow;
- `overflow: hidden` at the card boundary;
- a clear header, scrollable content region, and action footer.

The activity renderer is content inside this card. It may not redefine the outer workspace dimensions.

### 7.2 Card anatomy

```text
Practice Workspace Card
├── Header
│   ├── ordinal and title
│   ├── activity status and save status
│   ├── collapse/expand control
│   └── activity-list control
├── Activity content viewport
│   ├── instructions
│   ├── focused renderer
│   └── feedback/evaluation
└── Action footer
    ├── last saved or error state
    └── primary/secondary activity actions
```

CSS ownership should follow:

```css
.syn-practice-workspace-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
}
```

### 7.3 Header hierarchy

The header must visually group:

- `1/2` or `2/2` ordinal;
- activity title;
- active status;
- draft/save state;
- collapse or restore button;
- `Danh sách hoạt động` control when the navigator is not permanently visible.

Controls must use the shared button/icon-button components. Raw text buttons such as `Mở rộng Thu gọn` are not acceptable.

### 7.4 Content viewport

Only the card content region scrolls vertically. The header and footer remain visible unless the viewport is below the minimum supported height.

Activity instructions belong above the renderer and use the same horizontal padding as the footer.

### 7.5 Action footer

The footer belongs to the Practice card, not to the bottom of the browser viewport and not to the activity renderer’s internal scroll area.

It contains:

- saved timestamp or save/error status on the left;
- secondary action first;
- primary evaluation/run action last;
- next-activity action only after the current activity reaches the required state.

## 8. Activity Navigator

### 8.1 Separate responsibility

The Activity Navigator is a sibling of the Practice Workspace Card on wide desktop. It is not a `<details>` element nested inside Practice content.

Recommended component boundary:

```tsx
<PracticeActivityNavigator
  activities={activities}
  statuses={statuses}
  focusedActivityId={focusedActivityId}
  onSelectActivity={controller.focusActivity}
/>
```

### 8.2 Wide state

The navigator shows:

- heading such as `Thực hành · 2 hoạt động`;
- numbered activity items in authored order;
- title;
- status text;
- active highlight;
- optional concise single-editor guidance.

Selecting an item uses save-before-switch.

### 8.3 Narrow and compact states

- 1180–1439 px: anchored popover or side drawer;
- compact/tablet: drawer or controlled activity-list surface;
- collapsed desktop: 52–56 px Practice Rail;
- mobile: activity list inside the full-screen Practice surface.

The same activity list model must drive all presentations.

## 9. Contained activity renderer contract

### 9.1 Shell versus renderer responsibility

The shell owns:

- workspace card geometry;
- header;
- content scrolling;
- save/error messaging shared by all activities;
- footer position;
- activity navigation.

The renderer owns:

- activity-specific input controls;
- activity-specific feedback details;
- internal editor/output splits where necessary.

### 9.2 Surface contract

`ActivityHost` must receive an explicit presentation surface, for example:

```ts
type ActivityHostSurface = 'practice-contained' | 'standalone';

interface ActivityHostProps {
  readonly surface: ActivityHostSurface;
  // existing owner, activity, policy, persistence, and progress fields
}
```

The learning workspace always uses `practice-contained`.

### 9.3 Coding activity containment

In `practice-contained` mode, coding must not set `height: 100%` against an unconstrained ancestor or fill unused space with the dark editor surface.

Required behavior:

- editor and terminal/result remain inside a bounded internal grid;
- editor is the primary region;
- terminal/result has a reasonable minimum and maximum height;
- empty result space does not stretch to consume the Practice card;
- renderer actions that belong to the activity are exposed to the Practice footer or remain visually attached to the renderer’s bottom edge;
- code editor, terminal, and result subregions may scroll internally when needed.

At a 1600×1000 viewport, the coding renderer should read as a contained tool inside the Practice card, not as a full-height dark pane.

### 9.4 Other activity kinds

Ordering, writing, quiz, matching, numeric, and assessment activities use the same card frame. Their content may be shorter than available space; the shell must not artificially stretch individual controls.

## 10. Contextual AI dock

The AI assistant belongs to the learning workspace shell, not to Theory.

Wide desktop composition:

```text
Global navigation
Workspace main frame: Theory | Practice | Navigator
Contextual AI dock
```

The dock:

- spans the intended workspace width;
- uses a compact 52–64 px resting height;
- names its context: lesson or focused activity;
- does not reduce either pane’s scrollability;
- can expand into a drawer or sheet without covering the Practice action footer;
- becomes a bottom sheet trigger on mobile.

## 11. Responsive behavior

### 11.1 Compact desktop and tablet

Theory and Practice become controlled surfaces selected by tabs or a segmented switch. Only one surface is prominent at a time. The Activity Navigator opens as a drawer or popover.

Exactly one editor remains mounted.

### 11.2 Mobile

Practice opens as a full-screen surface within the learning shell. Closing returns to Theory without clearing focus or draft state.

The summary card remains the re-entry point. The Activity Navigator is available inside Practice. AI opens as a bottom sheet.

## 12. State and error behavior

- Draft-save state appears in the Practice header and/or footer.
- Save failure keeps the current renderer mounted and blocks switching.
- Presentation conflict recovery does not reset the renderer.
- Activity-load failure keeps the Practice card open with retry.
- Focused activity, collapsed state, navigator state where applicable, and split ratio survive refresh and runtime restart.
- Invalid persisted focus collapses safely while Theory remains usable.

## 13. Accessibility

- Opening Practice moves focus to the Practice heading after persistence succeeds.
- Activity selection announces the new title and save result.
- Collapse controls expose `aria-expanded` and `aria-controls`.
- The navigator exposes the active item using `aria-current` or an equivalent state.
- Status is available as text.
- Theory, Practice content, coding editor, terminal, and navigator are keyboard reachable.
- Focus does not move behind mobile sheets or compact drawers.
- Desktop divider remains keyboard operable.

## 14. Visual verification contract

Behavioral tests alone are insufficient for this revision.

The implementation must include structural geometry assertions and screenshot baselines for:

1. wide desktop with ordering activity active;
2. wide desktop with coding activity active;
3. wide desktop with Practice collapsed to rail;
4. 1366 px desktop with navigator popover/drawer behavior;
5. compact/tablet surface switching;
6. mobile full-screen Practice.

Required geometry assertions on wide desktop:

- three visible zones when viewport is at least 1440 px;
- Practice card is inset from its zone edges;
- Activity Navigator is a sibling, not nested in the Practice scroll content;
- Practice header and footer remain within the card viewport;
- coding dark surface occupies only the renderer region;
- Theory and Practice content scroll independently;
- exactly one active editor exists.

Screenshot review must compare ordering and coding states to ensure the outer shell remains visually identical while only renderer content changes.

## 15. Acceptance criteria

The revision is complete only when all conditions are true:

1. Exactly one editable activity renderer exists in the DOM.
2. Every authored activity position in Theory is a summary card.
3. Wide desktop renders Theory, Practice Workspace Card, and Activity Navigator as three distinct sibling zones.
4. The Practice Workspace Card has an inset outer surface, designed header, bounded content viewport, and attached footer.
5. Coding cannot stretch its dark surface across unused Practice height.
6. Activity Navigator no longer uses native `<details>` browser UI.
7. At narrower desktop widths, navigator presentation changes without creating an empty column.
8. Collapsing Practice produces a 52–56 px rail and preserves focused activity.
9. AI assistant is composed at workspace level and names its context.
10. Theory and Practice scroll independently.
11. All activity kinds and assessment use the same outer shell.
12. Save-before-switch, error recovery, refresh persistence, and runtime restart remain intact.
13. Geometry assertions and screenshot baselines pass for all required viewports and activity states.
14. Ordering and coding screenshots visibly match the approved shell composition.

## 16. Implementation impact

The existing presentation state, controller transaction model, status API, and persistence model remain valid.

Required implementation changes include:

- expand `LearningWorkspaceShell` to compose three wide-desktop zones;
- introduce a dedicated `PracticeActivityNavigator` presentation;
- replace the native `<details>` tray;
- turn `PracticePane` into a true workspace card with header/content/footer slots;
- add an explicit contained surface contract to `ActivityHost` and coding renderer;
- hoist `AssistantPanel` from Theory to workspace-shell composition;
- refine summary card anatomy and visual tokens;
- add structural and screenshot visual regression tests;
- reopen the previous visual-alignment and final-verification tasks.

## 17. Plan status

The implementation plan at `docs/superpowers/plans/2026-07-20-single-active-workspace-ui.md` is **superseded** because it assumed a two-pane desktop layout and did not define renderer containment or visual screenshot gates.

The approved replacement plan is `docs/superpowers/plans/2026-07-20-single-active-workspace-ui-revision-2.md`.

## 18. Non-goals

This revision does not introduce:

- multiple simultaneous Practice editors;
- detachable windows;
- collaborative editing;
- a new attempt model;
- a new persistence backend;
- a redesign of the global navigation;
- pixel-perfect dependence on one operating system’s font rasterization.
