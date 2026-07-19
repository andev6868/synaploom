# Rich Lesson Content and Multi-Domain Activity Engine Design

**Status:** Approved scope; design awaiting final review  
**Date:** 2026-07-18  
**Target release:** Course Schema 1.2.0  
**Supersedes:** Coding-only exercise assumptions in Course Schema 1.0/1.1

## 1. Purpose

Synaploom must support structured learning beyond programming. A course author must be able to teach programming, mathematics, language, literature, history, geography, science, and other subjects without each domain requiring a separate application shell.

This design introduces three coordinated changes:

1. `syn-learning-top-nav__steps` displays only the learning items in the active chapter.
2. Lesson Markdown becomes a safe, typed rich-document format with academic, pedagogical, media, and interactive blocks.
3. Coding exercises become one plugin in a generic Activity Engine supporting ten activity kinds in version 1.

The existing hierarchical progression model and unified learning workspace remain the product shell. The new document and activity systems plug into that shell instead of creating independent pages.

## 2. Product principles

### 2.1 One learning shell

Lessons, practice activities, and assessments use the same:

- top navigation;
- course and chapter context;
- AI assistant boundary;
- loading and error states;
- progression state;
- persistence model;
- accessibility conventions.

An activity is not a new application page. It is content rendered inside the active learning item.

### 2.2 Subject-neutral core

The core model uses domain-neutral concepts:

- document;
- activity;
- attempt;
- answer;
- evaluation;
- feedback;
- completion policy.

Domain-specific behavior belongs in activity renderers and evaluator plugins. The progression service only consumes normalized completion results.

### 2.3 Safe course packages

Course-authored content remains declarative and non-executable.

The platform does not render raw HTML, arbitrary React components, arbitrary iframes, or author-provided JavaScript. Markdown and activity manifests are parsed into validated typed structures before reaching the browser.

Coding activities retain the existing trusted local-runner boundary. Other activity kinds never acquire command-execution capabilities implicitly.

### 2.4 Progressive migration

Course Schema 1.0 and 1.1 packages remain loadable.

- A legacy `exercise.json` is normalized into an activity with `kind: "coding"`.
- A legacy chapter assessment is normalized into an assessment activity set.
- Existing lesson Markdown renders through the richer document model without requiring author changes.

New authoring capabilities require Course Schema 1.2.0.

## 3. Scope

### 3.1 Included

- Active-chapter-only top navigation steps.
- Canonical Go Markdown parsing and typed document output.
- Rich lesson document v1.
- Generic Activity Engine v1.
- Ten activity kinds:
  1. single choice;
  2. multiple choice;
  3. true/false;
  4. short answer;
  5. fill in the blanks;
  6. ordering;
  7. matching;
  8. numeric/math answer;
  9. long-form writing;
  10. coding workspace.
- Practice and assessment policies using the same activity renderer and attempt engine.
- Attempt persistence in SQLite.
- Legacy exercise and assessment adapters.
- Authoring validation and actionable diagnostics.
- Accessibility and keyboard interaction requirements.

### 3.2 Deferred

The following are explicit version-2 capabilities, not hidden requirements of v1:

- speech recognition and pronunciation grading;
- audio/video recording;
- AI-generated grading of essays;
- human instructor review workflows;
- diagram hotspots;
- geometry construction;
- graph drawing and symbolic proof checking;
- simulations and virtual laboratories;
- peer review;
- file uploads and portfolio submissions;
- executable MDX or custom course React components;
- remote iframe embeds;
- author-defined evaluator code outside the trusted coding runner.

The v1 schema must allow future activity kinds without changing progression semantics.

## 4. Active-chapter navigation steps

### 4.1 Current problem

`LearningTopNavigation` flattens every lesson and assessment in the course and renders one step per item. This makes the top bar grow with course size and prevents the user from understanding the local chapter sequence.

### 4.2 Required behavior

The step strip renders only items belonging to the chapter containing the viewed lesson or assessment.

```text
Active chapter: JavaScript Runtime
Steps: [Main Thread] [Event Loop] [Rendering Pipeline] [Assessment]
```

When the viewed item moves to another chapter, the strip is replaced with that chapter's items. It does not animate or preserve steps from the previous chapter.

### 4.3 Status semantics

Each step communicates both kind and status:

| Kind/state       | Visual semantic                        | Accessible label example                          |
| ---------------- | -------------------------------------- | ------------------------------------------------- |
| completed lesson | filled marker                          | `Main Thread, bài học, đã hoàn thành`             |
| current lesson   | emphasized ring                        | `Event Loop, bài học hiện tại`                    |
| available lesson | empty marker                           | `Rendering Pipeline, bài học tùy chọn, có thể mở` |
| locked lesson    | lock marker                            | `Rendering Pipeline, bài học bị khóa`             |
| assessment       | distinct `A` marker or assessment icon | `Runtime Checkpoint, đánh giá chương`             |

Color is supplementary. Every status has text in tooltip/accessibility output and a non-color visual distinction.

### 4.4 Progress label

The step group uses chapter-local progress:

```text
1/4 mục trong chương đã hoàn thành
```

Course-wide progress remains in the curriculum popover or future course overview.

### 4.5 Previous and next

Previous/next navigation retains the canonical course sequence and may cross chapter boundaries. Only the visual step strip is chapter-local.

## 5. Rich lesson document model

### 5.1 Canonical parser

Go is the canonical Markdown parser because the Go runtime owns course loading, validation, and API responses.

The TypeScript `packages/lesson-renderer` package becomes a renderer and shared type consumer. It must not maintain a second semantic Markdown parser for production content.

The normalization flow is:

```text
lesson.md
  -> Go Markdown parser
  -> validated LessonDocument
  -> protocol JSON
  -> React LessonDocumentRenderer
```

A TypeScript parser may remain only for isolated authoring previews if it consumes the same conformance fixtures and produces byte-equivalent normalized structures.

### 5.2 Inline nodes

Rich document v1 supports these inline nodes:

```ts
type InlineNode =
  | TextInline
  | EmphasisInline
  | StrongInline
  | StrikethroughInline
  | CodeInline
  | LinkInline
  | HardBreakInline
  | MathInline
  | KeyboardInline
  | SuperscriptInline
  | SubscriptInline
  | FootnoteReferenceInline;
```

All containers use nested `children: InlineNode[]`. Plain-text-only properties are retained only where semantic nesting is inappropriate, such as code source.

### 5.3 Block nodes

Rich document v1 supports:

#### Core Markdown

- heading;
- paragraph;
- blockquote;
- nested ordered and unordered list;
- task list;
- fenced code block;
- thematic break;
- table;
- footnote definition.

#### Pedagogical blocks

- callout: `note`, `hint`, `warning`, `important`, `misconception`;
- collapsible details;
- tabs;
- learning objectives;
- definition;
- theorem;
- proof;
- worked example;
- summary;
- vocabulary list;
- compare/contrast;
- step-by-step walkthrough;
- activity embed.

#### Academic and media blocks

- inline and display mathematics rendered with KaTeX;
- figure with local image, alt text, caption, source, and credit;
- local audio with transcript;
- local video with captions/transcript;
- downloadable local attachment.

Mermaid diagrams are deferred until a separate sandboxed diagram compilation design is approved.

### 5.4 Authoring syntax

Standard Markdown remains standard. Extended blocks use fenced directives:

```markdown
:::definition title="Định lý Pythagoras"
Với tam giác vuông: $a^2 + b^2 = c^2$.
:::

:::worked-example title="Tính cạnh huyền"

1. Thay $a=3$, $b=4$.
2. Tính $c=\sqrt{3^2+4^2}=5$.
   :::

:::activity id="pythagoras-numeric"
:::
```

Directive names and attributes are allowlisted. Unknown directives produce a validation error instead of silently rendering as text.

### 5.5 Tables

Tables support:

- inline content in cells;
- left, center, and right alignment;
- optional caption;
- horizontal scrolling on narrow screens;
- real `<table>` semantics with headers and caption.

Tables do not support arbitrary cell spans in v1.

### 5.6 Mathematics

Math uses TeX source and KaTeX rendering.

- Inline: `$...$`.
- Display: `$$...$$`.
- Unsupported commands generate an authoring diagnostic and render a safe source fallback in development mode.
- Macros are platform-defined; course packages cannot inject JavaScript or redefine dangerous output commands.

### 5.7 Media security

Media sources must resolve to validated paths inside the immutable course package.

- No `javascript:` URLs.
- No traversal outside the course root.
- Remote images, audio, and video are rejected in v1.
- External HTTPS links are allowed but receive safe `rel` attributes and clear external-link semantics.
- Audio and video require transcript or caption metadata to pass strict validation.

### 5.8 Activity embeds

An activity may be placed at a meaningful point in the lesson:

```markdown
:::activity id="event-loop-order"
:::
```

If a lesson declares activities but includes no embed, the renderer appends them after the lesson document in manifest order. This preserves compatibility and prevents invisible activities.

The same activity ID may appear only once in a lesson document.

## 6. Activity Engine domain model

### 6.1 Activity definition

Course Schema 1.2.0 introduces a generic activity manifest.

```ts
interface ActivityDefinition {
  readonly schemaVersion: '1.0';
  readonly id: Id;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly prompt: LessonDocumentFragment;
  readonly config: ActivityConfig;
  readonly evaluation: EvaluationPolicy;
  readonly completion: ActivityCompletionPolicy;
  readonly feedback?: FeedbackPolicy;
}
```

`config` is a discriminated union keyed by `kind`. A manifest cannot combine fields from different kinds.

### 6.2 Activity kinds

```ts
type ActivityKind =
  | 'single-choice'
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'fill-blanks'
  | 'ordering'
  | 'matching'
  | 'numeric'
  | 'writing'
  | 'coding';
```

### 6.3 Practice versus assessment

Practice and assessment are not separate renderer families.

An activity set supplies attempt and feedback policy:

```ts
interface ActivitySetPolicy {
  readonly purpose: 'practice' | 'assessment';
  readonly maxAttempts: number | null;
  readonly feedbackMode: 'immediate' | 'after-submit' | 'after-final-attempt';
  readonly revealAnswers: 'never' | 'after-submit' | 'after-final-attempt';
  readonly scoring: 'none' | 'points';
  readonly passingScore: number | null;
}
```

Practice normally allows unlimited attempts and immediate feedback. Assessment may limit attempts, delay feedback, aggregate points, and require a threshold.

### 6.4 Activity sets

Lessons and chapter assessments reference ordered activity sets.

```ts
interface ActivitySetDefinition {
  readonly id: Id;
  readonly title?: string;
  readonly policy: ActivitySetPolicy;
  readonly activities: readonly ActivityReference[];
}
```

A lesson may have zero or more practice sets. A chapter assessment references one assessment set.

### 6.5 Attempts

An attempt is the persisted learner interaction with one activity.

```ts
interface ActivityAttempt {
  readonly id: string;
  readonly courseId: string;
  readonly courseVersion: string;
  readonly ownerKind: 'lesson' | 'assessment';
  readonly ownerId: string;
  readonly activityId: string;
  readonly attemptNumber: number;
  readonly status: 'DRAFT' | 'SUBMITTED' | 'EVALUATED';
  readonly answer: ActivityAnswer;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly passed: boolean | null;
  readonly feedback: ActivityFeedback | null;
  readonly startedAt: string;
  readonly submittedAt: string | null;
  readonly evaluatedAt: string | null;
}
```

Drafts may be saved without affecting progression. Only submitted/evaluated attempts may satisfy completion.

### 6.6 Evaluation registry

The backend exposes an evaluator registry:

```go
type Evaluator interface {
    Kind() ActivityKind
    Evaluate(ctx context.Context, definition ActivityDefinition, answer ActivityAnswer) (EvaluationResult, error)
}
```

Evaluators are deterministic and side-effect-free except the existing coding evaluator, which delegates to the trusted runner boundary.

## 7. Activity kinds in detail

### 7.1 Single choice

Configuration:

- two or more options;
- one correct option;
- optional explanation per option;
- optional randomized display order with a persisted seed.

Answer: one option ID.

Evaluation: exact option-ID match.

Accessibility: native radio-group semantics and arrow-key navigation.

### 7.2 Multiple choice

Configuration:

- two or more options;
- one or more correct option IDs;
- evaluation mode `exact-set` or `partial-credit`;
- optional negative scoring is not supported in v1.

Answer: unique option-ID set.

Evaluation:

- exact-set: pass only if selected set equals correct set;
- partial-credit: score is correct selections minus incorrect selections, floored at zero and normalized to the activity points.

Accessibility: checkbox-group semantics.

### 7.3 True/false

Configuration:

- statement document fragment;
- expected boolean;
- optional explanation.

Answer: boolean.

This is a dedicated kind rather than a single-choice alias so authoring, analytics, accessibility labels, and future confidence capture remain explicit.

### 7.4 Short answer

Configuration:

- one or more accepted answers;
- normalization rules: trim, Unicode normalization, case sensitivity, whitespace collapse, optional punctuation removal;
- optional regex matching is allowed only through a validator-safe regular-expression subset;
- optional maximum length.

Answer: string.

Evaluation returns the normalized learner answer and a concise mismatch explanation without revealing accepted answers before policy permits.

### 7.5 Fill in the blanks

Configuration:

- a prompt document containing named blank tokens;
- accepted answers and normalization rules per blank;
- all-or-nothing or per-blank scoring.

Answer: map from blank ID to string.

The renderer uses real labeled inputs in reading order. Blank IDs are never shown as learner-facing labels.

### 7.6 Ordering

Configuration:

- ordered item definitions;
- optional distractors are not supported in v1;
- optional randomized initial order with persisted seed.

Answer: ordered item-ID array.

Evaluation supports:

- exact order;
- adjacent-position partial scoring for assessments.

Interaction supports drag-and-drop and equivalent keyboard controls with move-up/move-down actions.

### 7.7 Matching

Configuration:

- left-side prompts;
- right-side choices;
- one-to-one mappings in v1;
- randomized right-side display with persisted seed.

Answer: map from left ID to right ID.

The keyboard-accessible fallback uses selects or an explicit pairing workflow, not drag-and-drop alone.

### 7.8 Numeric and mathematical answer

Configuration:

```ts
interface NumericActivityConfig {
  readonly answerMode: 'number' | 'expression';
  readonly expected: string;
  readonly absoluteTolerance?: number;
  readonly relativeTolerance?: number;
  readonly unit?: string;
  readonly requireUnit?: boolean;
}
```

V1 evaluation supports:

- decimal and scientific notation;
- locale-aware input normalization;
- absolute/relative numeric tolerance;
- unit normalization for an allowlisted unit registry;
- algebraic expression equivalence for a deliberately limited arithmetic expression grammar.

V1 does not attempt general theorem proving, symbolic integration, arbitrary equation solving, or geometry validation.

### 7.9 Long-form writing

Configuration:

- prompt;
- minimum and maximum character count;
- optional rubric criteria shown to the learner;
- optional outline prompts.

Answer: plain text or safe Markdown subset.

V1 does not auto-grade writing quality. Evaluation policy is `submission`:

- valid non-empty submission satisfies a practice activity;
- score and pass remain `null` unless a future reviewer/evaluator supplies them;
- a scored assessment cannot depend on a submission-only writing activity in Course Schema 1.2.0 strict mode.

This avoids pretending that keyword matching is meaningful essay evaluation while still supporting reflection, explanation, and writing practice.

### 7.10 Coding

The existing coding workspace becomes the `coding` activity plugin.

Configuration retains:

- runtime requirements;
- starter workspace;
- editable paths;
- allowlisted actions;
- checks;
- completion rules.

The runner, terminal, files, process events, and check evaluator remain behind the current trusted local-runtime boundary.

Legacy `exercise.json` is adapted to this configuration without changing course behavior.

## 8. Course Schema 1.2.0 authoring model

### 8.1 Lesson front matter

Lesson front matter gains activity-set references:

```yaml
---
id: event-loop
title: Event Loop
position: 2
type: mixed
estimatedMinutes: 25
activitySets:
  - activities/event-loop-practice.json
---
```

The legacy `exercise` property remains accepted in 1.0/1.1 and is rejected in newly authored strict 1.2 packages in favor of activity sets.

### 8.2 Activity directory

Recommended package layout:

```text
lessons/02-event-loop/
├── lesson.md
├── activities/
│   ├── event-loop-practice.json
│   ├── order-phases.activity.json
│   └── event-loop-code.activity.json
├── starter/
└── checks/
```

Activity set files reference activity files by safe relative path. All references are resolved relative to the owning lesson or assessment directory and may not escape it unless a future shared-library mechanism is explicitly added.

### 8.3 Chapter assessment

A Course Schema 1.2 assessment entry references an assessment manifest that contains an activity set:

```json
{
  "schemaVersion": "1.0",
  "id": "runtime-capstone",
  "title": "Runtime Performance Diagnosis",
  "activitySet": "runtime-capstone.activities.json"
}
```

The existing coding-only assessment manifest is normalized as one coding activity for compatibility.

## 9. Unified workspace UX

### 9.1 Activity host

`ActivityHost` selects a renderer by `activity.kind`:

```text
ActivityHost
├── ChoiceActivity
├── TrueFalseActivity
├── ShortAnswerActivity
├── FillBlanksActivity
├── OrderingActivity
├── MatchingActivity
├── NumericActivity
├── WritingActivity
└── CodingActivity
```

Single and multiple choice may share internal components but remain distinct public kinds.

### 9.2 Layout modes

The unified workspace chooses a layout from content and activity capabilities:

- `reading`: full-width lesson document, no activity.
- `inline-activity`: document with embedded compact activities.
- `focused-activity`: full-width assessment or large activity.
- `split-coding`: lesson/document left, coding workspace right.

A course author does not choose arbitrary CSS layout. The platform derives layout from activity kind and placement.

### 9.3 Activity state

Every renderer shows a consistent state surface:

- not started;
- draft saved;
- ready to submit;
- submitting;
- evaluated;
- correct/passed;
- incorrect/not passed;
- attempts remaining;
- locked;
- error with retry.

The submit button copy is specific:

- `Kiểm tra đáp án` for practice with immediate feedback;
- `Nộp câu trả lời` for delayed or assessment feedback;
- `Chạy chương trình` and `Kiểm tra kết quả` remain coding actions;
- `Lưu bản nháp` is used where draft persistence matters.

### 9.4 Feedback

Feedback is structured rather than a single string:

```ts
interface ActivityFeedback {
  readonly summary: string;
  readonly details: readonly FeedbackItem[];
  readonly correctAnswer?: RevealedAnswer;
  readonly nextAction?: 'retry' | 'continue' | 'review-content';
}
```

Correct answers are included only when the activity-set reveal policy permits.

### 9.5 Progression integration

An activity set exposes normalized completion:

```ts
interface ActivitySetProgress {
  readonly status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  readonly completedRequiredActivities: number;
  readonly requiredActivities: number;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly passed: boolean | null;
}
```

Lesson requirements reference activity-set completion rather than coding check IDs directly. Legacy check requirements are mapped through the coding adapter.

## 10. Persistence and API

### 10.1 SQLite tables

The migration introduces:

- `activity_attempts`;
- `activity_attempt_answers` or canonical JSON answer storage;
- `activity_evaluations`;
- optional `activity_drafts` if drafts are separated from attempts.

The preferred v1 model stores a canonical JSON answer and feedback payload in the attempt row, with indexed identity/status columns. Schema validation occurs before persistence.

Required uniqueness:

```text
(course_id, course_version, owner_kind, owner_id, activity_id, attempt_number)
```

### 10.2 API surface

Minimum API:

```text
GET  /api/v1/courses/{courseId}/activities/{activityId}
GET  /api/v1/courses/{courseId}/activities/{activityId}/attempts/current
PUT  /api/v1/courses/{courseId}/activities/{activityId}/attempts/current/draft
POST /api/v1/courses/{courseId}/activities/{activityId}/attempts
GET  /api/v1/courses/{courseId}/activity-sets/{setId}/progress
```

Owner context is included in the request/query or canonical route to disambiguate repeated activity IDs. The final implementation plan must choose one canonical route and use it consistently.

Coding run/check endpoints may remain during migration but are called through the coding activity client facade.

### 10.3 Idempotency and concurrency

- Draft updates use optimistic revision or `updatedAt` preconditions.
- Attempt submission accepts an idempotency key.
- Duplicate submissions return the existing evaluation.
- A submitted attempt is immutable.
- Randomized activities persist their seed with the attempt so reload does not reorder answers unexpectedly.

## 11. Validation and diagnostics

Validation occurs before course import and reports source paths.

Examples:

```text
ACTIVITY_KIND_UNSUPPORTED
ACTIVITY_ID_DUPLICATE
ACTIVITY_REFERENCE_NOT_FOUND
ACTIVITY_EMBED_DUPLICATE
ACTIVITY_CONFIG_INVALID
ACTIVITY_ANSWER_KEY_UNKNOWN
ASSESSMENT_SCORE_REQUIRES_SCORABLE_ACTIVITY
MEDIA_TRANSCRIPT_REQUIRED
MATH_SOURCE_INVALID
DOCUMENT_DIRECTIVE_UNKNOWN
DOCUMENT_ASSET_OUTSIDE_COURSE
```

Validation must distinguish author errors from runtime errors. Runtime APIs never expose stack traces or filesystem paths to the browser.

## 12. Accessibility

All activity kinds must be usable without a pointer.

- Choice activities use native form controls.
- Ordering includes explicit keyboard move controls and announces position changes.
- Matching has a non-drag pairing workflow.
- Fill blanks have programmatic labels and error associations.
- Math input exposes the source value and descriptive label; KaTeX output is supplementary.
- Writing shows character count through polite live regions.
- Coding retains keyboard-first editor and terminal behavior.
- Feedback moves focus to a summary heading after submission without destroying the learner's answer context.
- Activity status never relies on color alone.

## 13. Security model

### 13.1 Declarative activities

All non-coding activity configuration is pure data validated against JSON Schema and generated contracts.

No activity manifest may specify:

- executable paths;
- shell commands;
- network requests;
- HTML;
- JavaScript;
- iframe sources.

### 13.2 Coding capability isolation

Only `kind: "coding"` can reference the trusted runner configuration. The validator rejects runtime/workspace/action fields on every other activity kind.

### 13.3 Answer privacy

Correct answers are not included in initial browser payloads when feedback policy delays or forbids reveal. Evaluation-sensitive fields are retained server-side and represented by public activity views without answer keys.

This requires separate author/internal and learner/public protocol shapes.

## 14. Analytics and observability

V1 records local product events without requiring cloud telemetry:

- activity started;
- draft saved;
- attempt submitted;
- attempt evaluated;
- activity completed;
- activity abandoned;
- evaluator error.

Events use activity kind and IDs but do not log free-text writing answers, code contents, or personal media.

Structured logs include evaluator duration and error code for diagnostics.

## 15. Migration strategy

### Phase 1: Foundations

- Active-chapter step filtering.
- Course Schema 1.2 types and validators.
- Rich document protocol and canonical Go parser.
- Activity definition, public view, attempt, answer, evaluation, and feedback contracts.

### Phase 2: Deterministic activities

Implement single choice, multiple choice, true/false, short answer, fill blanks, ordering, matching, and numeric activities with persistence and evaluation.

### Phase 3: Open and coding activities

- Writing activity with submission completion.
- Coding adapter around existing exercise runtime.
- Legacy exercise migration.

### Phase 4: Unified assessment migration

- Assessment activity sets.
- Scoring and passing threshold aggregation.
- Legacy chapter assessment adapter.
- Progression requirements based on activity-set completion.

### Phase 5: Authoring and example courses

Create cross-domain examples:

- programming lesson with coding and ordering;
- mathematics lesson with numeric/math input;
- English lesson with fill blanks and matching;
- literature lesson with short answer and writing;
- science/history lesson with ordering and multiple choice.

## 16. Compatibility rules

- Existing 1.0 and 1.1 courses load unchanged.
- Existing API fields remain available during one compatibility window.
- Legacy `exercise` is exposed as a single coding activity to new frontend code.
- New 1.2 activity packages are rejected by runtimes that do not advertise Course Schema 1.2 support.
- Build metadata and `doctor --json` report Course Schema 1.2.0 after rollout.
- Generated Go and TypeScript contracts remain the source of protocol truth.

## 17. Testing strategy

### 17.1 Contract conformance

- JSON Schema fixtures for every activity kind.
- Generated Go and TypeScript round trips.
- Public views prove answer keys are absent.
- Legacy exercise normalization fixtures.

### 17.2 Parser conformance

- Golden Markdown fixtures for every inline and block type.
- Unsafe HTML and paths are rejected or represented as inert diagnostics.
- Go parser output is stable.
- Optional TypeScript preview parser must match golden output.

### 17.3 Evaluator tests

Each evaluator has table-driven tests for:

- correct answer;
- incorrect answer;
- malformed answer;
- normalization;
- scoring boundaries;
- reveal policy;
- deterministic random seed behavior where applicable.

### 17.4 Persistence tests

- draft survives restart;
- submitted attempt is immutable;
- duplicate idempotent submission returns the same result;
- attempt numbering is monotonic;
- activity-set progress recomputes correctly;
- review does not alter current progression.

### 17.5 UI tests

- active chapter steps only;
- keyboard interaction for every activity kind;
- error and retry states;
- answer retained after failed network request;
- feedback focus management;
- assessment and practice policy differences;
- reading, inline, focused, and split-coding layouts.

### 17.6 Browser acceptance

End-to-end flows cover at least one course from each representative domain family:

- programming;
- mathematics;
- language;
- humanities;
- science.

## 18. Acceptance criteria

The feature is complete when:

1. The top step strip never displays items outside the viewed chapter.
2. Course-wide navigation remains available through selectors and curriculum popover.
3. Lesson content renders all rich document v1 nodes without raw executable markup.
4. The Go parser is canonical and production frontend does not independently reinterpret Markdown.
5. All ten activity kinds can be authored, validated, rendered, answered, persisted, and completed.
6. Practice and assessment reuse the same activity engine with different policies.
7. Correct answers are not leaked before reveal policy allows them.
8. Coding exercises continue to work through a compatibility adapter.
9. Existing Course Schema 1.0 and 1.1 examples remain valid and runnable.
10. A Course Schema 1.2 example demonstrates programming, math, English, literature, and science/history activities.
11. Keyboard-only users can complete every deterministic v1 activity.
12. Progression updates from normalized activity-set completion rather than UI-local assumptions.

## 19. Architectural decisions

This design makes the following explicit choices:

- **Course Schema 1.2.0**, not 2.0, because the change is additive with compatibility adapters.
- **Go canonical document parser**, eliminating production parser divergence.
- **Generic activity engine with plugin renderers**, not separate subject workspaces.
- **Declarative JSON activity manifests**, not MDX or executable course components.
- **Shared engine for practice and assessment**, differentiated by policy.
- **Submission-only long-form writing in v1**, avoiding false automatic grading claims.
- **Coding as a privileged plugin**, preserving its stricter execution security boundary.
- **Active-chapter top steps**, while previous/next and curriculum retain course-wide navigation.
