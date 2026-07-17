# Hierarchical Learning Progression and Review Navigation

**Status:** Proposed for implementation
**Date:** 2026-07-17
**Scope:** Synaploom native Go runtime, Course Schema, progression persistence, HTTP API, and React learning workspace

## 1. Purpose

Synaploom currently models progression primarily as a linear sequence of lessons. That model is insufficient for courses that contain chapters, lesson-level practices, chapter-level assessments, optional work, and review of previously completed material.

This design introduces a hierarchical progression model:

```text
Course
└── Chapter
    ├── Lesson
    │   ├── Reading requirement
    │   └── Lesson practices
    └── Chapter assessments
```

The system must answer four questions without making the browser reproduce business rules:

1. What has the learner completed?
2. What is unlocked now?
3. What item is the learner currently progressing through?
4. What item is the learner merely viewing or reviewing?

The Go runtime remains authoritative for completion, unlocks, progression, and next actions. React renders the state and sends explicit mutations; it does not infer progression independently.

## 2. Product decisions

### 2.1 Progression policy for V1

V1 uses **strict sequential progression**.

- The next required lesson opens after the current required lesson is completed.
- A chapter assessment opens after its declared prerequisite lessons are completed.
- The next chapter opens only after the current chapter's required lessons and required chapter assessments are complete.
- Optional lessons and optional practices never block progression.
- The internal model uses explicit requirements so a prerequisite graph can be introduced later without replacing persistence or API concepts.

### 2.2 Completion is derived, not manually declared

Users do not manually command the system to complete a chapter or course. Completion is derived from satisfied requirements.

```text
required reading
+ required lesson practices
→ lesson completed

required lessons
+ required chapter assessments
→ chapter completed

required chapters
+ required course assessments, if any
→ course completed
```

A CTA may navigate to the next item, but navigation must not be confused with a completion mutation.

### 2.3 Completed lessons remain reviewable

A completed lesson remains permanently accessible unless the course itself is removed.

Reviewing a completed lesson must not:

- change `currentLessonId`;
- relock later lessons or chapters;
- reset completion timestamps;
- reset best practice results;
- change chapter or course completion;
- require the learner to complete the lesson again.

Progression and navigation are separate concepts:

```text
current progression item ≠ viewed item
```

## 3. Goals

1. Represent courses containing chapters, lessons, lesson practices, and chapter assessments.
2. Support required and optional items at every relevant level.
3. Calculate lesson, chapter, and course completion in the Go runtime.
4. Return a single backend-authored `nextAction` instead of requiring React to infer one.
5. Allow completed lessons and assessments to be reopened safely in review mode.
6. Preserve completion when a learner resets a workspace or later produces a failed attempt.
7. Give `syn-lesson-progress` enough information to act as hierarchical learning navigation.
8. Preserve a clean migration path from the existing linear course format and progress records.

## 4. Non-goals for V1

- Arbitrary prerequisite DAG authoring.
- Spaced-repetition scheduling or forgetting-curve algorithms.
- Instructor/manual review workflows.
- Competitive grading, certificates, or cohort analytics.
- Concurrent progress synchronization across multiple machines.
- Rollback of completion after a course definition changes; content-version migration is handled separately.
- Multiple active progression branches inside one chapter.

## 5. Domain model

### 5.1 Course structure

```ts
type CourseDefinition = {
  id: string;
  title: string;
  version: string;
  chapters: readonly ChapterDefinition[];
  assessments?: readonly CourseAssessmentDefinition[];
};

type ChapterDefinition = {
  id: string;
  title: string;
  position: number;
  required: boolean;
  lessons: readonly ChapterLessonReference[];
  assessments: readonly ChapterAssessmentDefinition[];
};

type ChapterLessonReference = {
  lessonId: string;
  required: boolean;
};
```

The lesson document continues to own lesson content and lesson-practice definitions. The chapter owns ordering, requirement status, and chapter assessment definitions.

### 5.2 Unified requirement representation

The runtime normalizes course structure into requirements:

```ts
type Requirement = {
  id: string;
  scope: "lesson" | "chapter" | "course";
  kind: "reading" | "lesson_practice" | "chapter_assessment" | "course_assessment";
  ownerId: string;
  targetId: string;
  required: boolean;
  satisfied: boolean;
};
```

This is an internal evaluation model. Author-facing course files remain structured around chapters, lessons, and assessments rather than exposing a flat requirement list.

### 5.3 Lesson practices

A lesson may have zero or more practices.

```ts
type PracticeDefinition = {
  id: string;
  title: string;
  required: boolean;
  completionRule: CompletionRule;
};

type CompletionRule =
  | { type: "ALL_REQUIRED_CHECKS" }
  | { type: "MINIMUM_SCORE"; threshold: number };
```

V1 execution may initially implement only `ALL_REQUIRED_CHECKS`, but the schema and domain types reserve `MINIMUM_SCORE` so the evaluator boundary does not have to be redesigned.

### 5.4 Chapter assessments

A chapter assessment is a first-class entity, not a fake final lesson.

```ts
type ChapterAssessmentDefinition = {
  id: string;
  title: string;
  required: boolean;
  prerequisites: {
    lessonIds: readonly string[];
  };
  exercise: ExerciseDefinition;
  completionRule: CompletionRule;
};
```

A chapter may have:

- no assessment;
- one required assessment;
- several required assessments;
- optional assessments in addition to required assessments.

### 5.5 Persistent progress

```ts
type LessonProgress = {
  lessonId: string;
  status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
  readingCompleted: boolean;
  startedAt?: string;
  completedAt?: string;
  practices: readonly PracticeProgress[];
};

type PracticeProgress = {
  practiceId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "PASSED" | "FAILED";
  attempts: number;
  bestResult: AttemptResult | null;
  latestResult: AttemptResult | null;
};

type AttemptResult = {
  passed: boolean;
  score?: number;
  completedAt: string;
  summary?: string;
};

type ChapterProgress = {
  chapterId: string;
  status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "ASSESSMENT_REQUIRED" | "COMPLETED";
  startedAt?: string;
  completedAt?: string;
  assessments: readonly PracticeProgress[];
};

type CourseProgress = {
  courseId: string;
  status: "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
  currentChapterId: string | null;
  currentLessonId: string | null;
  completedAt?: string;
};
```

`bestResult` is authoritative for completion. `latestResult` describes the learner's most recent attempt. A later failed attempt must not revoke a previously satisfied requirement.

## 6. Completion rules

### 6.1 Lesson completion

A lesson is complete when:

```text
reading requirement is satisfied
AND every required lesson practice has bestResult.passed = true
```

Rules by lesson shape:

| Lesson shape | Reading mutation | Completion behavior |
|---|---|---|
| Reading only | User confirms reading | Lesson completes immediately |
| Reading + required practices | User confirms reading | Lesson remains in progress until required practices pass |
| Reading + optional practices only | User confirms reading | Lesson completes; optional practices remain available |
| Practice only | No reading requirement | Completes after required practices pass |

### 6.2 Chapter completion

A chapter is complete when:

```text
every required lesson is completed
AND every required chapter assessment has bestResult.passed = true
```

If all required lessons are complete but a required chapter assessment remains, the chapter enters `ASSESSMENT_REQUIRED`.

If a chapter has no required chapter assessment, it completes automatically when required lessons complete.

### 6.3 Course completion

A course is complete when:

```text
every required chapter is completed
AND every required course-level assessment is passed, if present
```

Course-level assessments are represented in the model but may be excluded from the first UI delivery if the current product has no authoring use case for them.

## 7. Unlock rules

### 7.1 Lesson unlock

Under the V1 sequential policy:

- The first required lesson in the first required chapter is available initially.
- Completing a required lesson opens the next required lesson in that chapter.
- Optional lessons become available when their chapter becomes available. They do not interrupt the required sequence.
- Locked lessons cannot be opened and return a typed error containing the blocking requirement.

### 7.2 Chapter assessment unlock

An assessment opens when all lesson IDs declared in its prerequisites are completed.

The default authoring shorthand for a required chapter assessment is “all required lessons in this chapter.” Explicit prerequisites are still stored after normalization.

### 7.3 Chapter unlock

The next required chapter opens when the previous required chapter completes.

Optional chapters may be available when their preceding required chapter opens or completes according to an explicit authoring policy. V1 defaults to availability after the preceding required chapter completes.

## 8. Navigation and review model

### 8.1 Separate progression from viewing

The runtime distinguishes:

```ts
type LearningNavigation = {
  currentChapterId: string | null;
  currentLessonId: string | null;
  viewedChapterId: string;
  viewedItemId: string;
  viewMode: "LEARNING" | "REVIEW";
  returnTarget?: NavigationTarget;
};
```

`currentLessonId` is persisted progression state. `viewedItemId` is request/URL state and normally is not persisted.

### 8.2 Review mode

A completed lesson opened while a later item is current is returned with:

```json
{
  "viewMode": "REVIEW",
  "currentLessonId": "rendering-pipeline",
  "viewedLessonId": "event-loop",
  "returnTarget": {
    "type": "LESSON",
    "id": "rendering-pipeline",
    "label": "Quay lại bài đang học"
  }
}
```

In review mode:

- lesson content remains readable;
- workspace remains usable;
- actions remain runnable;
- reset affects workspace only;
- completion mutations are hidden or become idempotent;
- a failed new check updates `latestResult` but not `bestResult`;
- lesson, chapter, and course completion remain intact.

### 8.3 Stable deep links

Canonical URLs include chapter and lesson identity:

```text
/courses/{courseId}/chapters/{chapterId}/lessons/{lessonId}
/courses/{courseId}/chapters/{chapterId}/assessments/{assessmentId}
```

The runtime may continue supporting the current shorter lesson URL as a compatibility redirect during migration.

## 9. Backend-authored next action

Every learner-facing progress response includes a single next action:

```ts
type NextAction =
  | { type: "ACKNOWLEDGE_READING"; lessonId: string }
  | { type: "START_REQUIRED_PRACTICE"; lessonId: string; practiceId: string }
  | { type: "RETRY_REQUIRED_PRACTICE"; lessonId: string; practiceId: string }
  | { type: "CONTINUE_TO_LESSON"; chapterId: string; lessonId: string }
  | { type: "START_CHAPTER_ASSESSMENT"; chapterId: string; assessmentId: string }
  | { type: "RETRY_CHAPTER_ASSESSMENT"; chapterId: string; assessmentId: string }
  | { type: "CONTINUE_TO_CHAPTER"; chapterId: string }
  | { type: "RETURN_TO_CURRENT_LESSON"; chapterId: string; lessonId: string }
  | { type: "VIEW_COURSE_SUMMARY" }
  | { type: "NONE" };
```

React maps this value to one primary CTA. It must not duplicate the requirement evaluation logic.

## 10. API design

### 10.1 Course navigation response

```http
GET /api/v1/courses/{courseId}/navigation
```

```json
{
  "course": {
    "id": "frontend-performance-foundations",
    "status": "IN_PROGRESS",
    "currentChapterId": "javascript-runtime",
    "currentLessonId": "rendering-pipeline"
  },
  "chapters": [
    {
      "id": "javascript-runtime",
      "title": "JavaScript Runtime",
      "status": "ASSESSMENT_REQUIRED",
      "required": true,
      "lessons": [
        {
          "id": "event-loop",
          "title": "Event Loop",
          "status": "COMPLETED",
          "required": true,
          "reviewable": true
        }
      ],
      "assessments": [
        {
          "id": "diagnose-main-thread",
          "title": "Diagnose Main Thread Blocking",
          "status": "AVAILABLE",
          "required": true
        }
      ]
    }
  ],
  "nextAction": {
    "type": "START_CHAPTER_ASSESSMENT",
    "chapterId": "javascript-runtime",
    "assessmentId": "diagnose-main-thread"
  }
}
```

### 10.2 Lesson response

The lesson response adds:

```ts
type LessonViewContext = {
  chapterId: string;
  status: LessonStatus;
  required: boolean;
  readingCompleted: boolean;
  requirements: readonly RequirementView[];
  viewMode: "LEARNING" | "REVIEW";
  currentLessonId: string | null;
  returnTarget?: NavigationTarget;
  nextAction: NextAction;
};
```

### 10.3 Mutations

Existing mutations remain explicit:

```http
POST /api/v1/lessons/{lessonId}/reading-complete
POST /api/v1/lessons/{lessonId}/actions/{actionId}
POST /api/v1/lessons/{lessonId}/workspace/reset
```

The current generic `POST /lessons/{lessonId}/complete` endpoint becomes deprecated. During migration it may remain idempotent, but it must delegate to the requirement engine and reject manual completion when required conditions are unsatisfied.

Chapter assessments use parallel routes:

```http
POST /api/v1/chapters/{chapterId}/assessments/{assessmentId}/actions/{actionId}
GET  /api/v1/chapters/{chapterId}/assessments/{assessmentId}
```

### 10.4 Errors

Typed errors include:

- `ITEM_LOCKED`
- `REQUIREMENT_UNSATISFIED`
- `LESSON_NOT_FOUND`
- `CHAPTER_NOT_FOUND`
- `ASSESSMENT_NOT_FOUND`
- `COURSE_DEFINITION_INVALID`

A locked-item error returns blocking requirements and the current item target.

## 11. `syn-lesson-progress` UX specification

### 11.1 Role

`syn-lesson-progress` becomes a hierarchical learning navigator, not merely a numeric progress bar.

It must show:

- chapters;
- lessons;
- chapter assessments;
- required versus optional labels;
- completed, current, viewed, available, and locked distinctions;
- the reason a locked item is unavailable;
- review mode for completed lessons;
- the current best next action.

### 11.2 Visual semantics

The component distinguishes at least:

```text
✓ completed
● current progression item
◉ viewed item
○ available
🔒 locked
```

When viewing a completed lesson while another lesson is current:

```text
✓ Event Loop                 Đang xem lại
● Rendering Pipeline         Bài đang học
```

Color alone must not carry meaning. Labels, icons, and accessible text are required.

### 11.3 Click behavior

| Item state | Clickable | Result |
|---|---:|---|
| `LOCKED` | No | Show blocking requirement explanation |
| `AVAILABLE` | Yes | Navigate and start/continue item |
| `IN_PROGRESS` | Yes | Navigate to active item |
| `COMPLETED` | Yes | Navigate in review mode |
| Optional item in available chapter | Yes | Navigate without changing required sequence |

Opening a completed item is a GET/navigation operation and cannot mutate progression.

### 11.4 Completion CTA replacement

The existing pair of buttons—“Hoàn thành phần đọc” and “Hoàn thành bài học”—is replaced by a requirement-aware footer.

Examples:

**Reading-only lesson**

```text
[Hoàn thành bài học]
```

**Lesson with required practice**

```text
✓ Đã đọc nội dung
○ Event Loop output order    Bắt buộc

[Đi đến bài thực hành]
```

**Required work complete**

```text
✓ Tất cả yêu cầu bắt buộc đã hoàn thành

[Tiếp tục bài tiếp theo]
```

**Final lesson before chapter assessment**

```text
✓ Đã hoàn thành tất cả bài học bắt buộc

[Bắt đầu thực hành của chương]
```

**Review mode**

```text
✓ Bài học đã hoàn thành · Đang xem lại

[Quay lại bài đang học]
```

### 11.5 Optional work

Optional practices are clearly labeled and never block the primary CTA.

After required work completes:

```text
Bạn đã hoàn thành các yêu cầu bắt buộc.

[Tiếp tục bài tiếp theo]
[Làm thêm bài tùy chọn]
```

## 12. Course schema evolution

### 12.1 Proposed chapter schema

```json
{
  "schemaVersion": "1.1.0",
  "id": "frontend-performance-foundations",
  "title": "Frontend Performance Foundations",
  "chapters": [
    {
      "id": "javascript-runtime",
      "title": "JavaScript Runtime",
      "required": true,
      "lessons": [
        { "id": "main-thread", "required": true },
        { "id": "event-loop", "required": true },
        { "id": "scheduler-deep-dive", "required": false }
      ],
      "assessments": [
        {
          "id": "diagnose-main-thread",
          "title": "Diagnose Main Thread Blocking",
          "required": true,
          "path": "assessments/diagnose-main-thread",
          "requiresLessons": ["main-thread", "event-loop"],
          "completion": { "type": "all-required-checks" }
        }
      ]
    }
  ]
}
```

### 12.2 Linear course compatibility

A Course Schema 1.0 course containing only a flat lesson list is normalized into one implicit chapter:

```text
chapter id: default
chapter title: course title
all existing lessons: required
chapter assessments: none
```

This keeps existing examples and learner progress usable.

### 12.3 Validation rules

Validation rejects:

- duplicate chapter, lesson, practice, or assessment IDs;
- references to missing lessons;
- required assessments with no executable actions/checks;
- prerequisite references outside the owning chapter in V1;
- empty required chapters;
- impossible sequential order;
- optional item marked as a blocker in normalized requirements.

## 13. Persistence and migration

### 13.1 Storage changes

The SQLite model needs persistent records for:

- chapters;
- lesson progress;
- lesson practice attempts and best result;
- chapter assessment progress and attempts;
- course current chapter/current lesson;
- completion timestamps.

Navigation-only fields such as `viewedLessonId` are not persisted as progression.

### 13.2 Migration of existing records

For each existing course progress record:

1. Create the implicit `default` chapter.
2. Preserve every lesson status and completion timestamp.
3. Set `currentChapterId = default` when a current lesson exists.
4. Convert existing successful `latestCheck` data into both `bestResult` and `latestResult`.
5. Preserve current lesson identity.
6. Recalculate derived chapter/course status from migrated requirements.

The migration is idempotent and runs inside a verified backup transaction.

## 14. Architecture boundaries

### 14.1 Course definition loader

Responsibilities:

- parse schema versions;
- normalize 1.0 flat courses into chapters;
- validate chapter/lesson/assessment references;
- expose immutable definitions.

It does not evaluate learner progress.

### 14.2 Requirement engine

Responsibilities:

- derive requirement satisfaction;
- calculate lesson/chapter/course status;
- calculate unlocks;
- calculate the backend-authored next action.

It is a pure domain package with deterministic table-driven tests. It does not access HTTP, filesystems, or SQLite directly.

### 14.3 Progression service

Responsibilities:

- own transactional mutations;
- load definitions and persisted progress;
- apply reading and attempt results;
- invoke the requirement engine;
- persist state transitions atomically;
- publish updated navigation snapshots.

### 14.4 Practice runtime

Responsibilities remain execution-oriented:

- prepare workspace;
- run declared actions;
- stream output;
- produce attempt results.

It does not decide lesson or chapter completion. It submits results to the progression service.

### 14.5 HTTP API

Responsibilities:

- authenticate the local browser session;
- validate identifiers and request shapes;
- map typed domain errors to HTTP responses;
- return progression snapshots.

It does not implement requirement rules.

### 14.6 React application

Responsibilities:

- render navigation, requirements, and next action;
- manage URL/view state;
- submit explicit mutations;
- invalidate/refetch authoritative snapshots.

It does not determine unlock or completion status locally.

## 15. Transaction and concurrency rules

1. A practice attempt may finish concurrently with a navigation read.
2. Persist the attempt result and derived progression in one transaction.
3. Publish terminal completion only after the attempt result is durable, preventing the UI refresh race already observed in the practice flow.
4. Repeated reading-complete or successful-attempt submissions are idempotent.
5. Completion timestamps are set once and never moved backward.
6. `bestResult` changes only when the new attempt is better according to the completion rule.
7. Resetting a workspace never mutates progression records.

## 16. Accessibility and responsive behavior

- Progress items are keyboard navigable.
- Locked items expose their reason through accessible text, not tooltip-only content.
- Current and viewed states use both labels and visual indicators.
- Mobile/compact mode renders one summary row and opens a chapter-grouped drawer.
- Desktop expanded mode may remain visible in the lesson navigation column.
- The primary next-action control appears once per screen; duplicate footer/header CTAs are avoided.

## 17. Observability

Structured diagnostics include:

- requirement evaluation failures;
- invalid course graph normalization;
- attempted access to locked items;
- progression transitions with course/chapter/item IDs;
- assessment attempt outcome and duration;
- migration counts and recalculated statuses.

Logs must not include learner source files or terminal output unless diagnostics explicitly request and redact them.

## 18. Testing strategy

### 18.1 Requirement engine tests

Table-driven coverage includes:

- reading-only lesson;
- required and optional lesson practices;
- later failed attempt after prior success;
- chapter with no assessment;
- chapter with required and optional assessments;
- locked, available, assessment-required, and completed transitions;
- course completion;
- sequential next-action selection.

### 18.2 Persistence tests

- migration from flat linear progress;
- transaction rollback on persistence failure;
- restart persistence of current item and best results;
- workspace reset preserving completion;
- idempotent repeated mutations.

### 18.3 API contract tests

- navigation snapshot shape;
- review-mode lesson response;
- locked-item typed errors;
- reading and attempt result mutations;
- chapter assessment routes;
- deprecated manual-complete behavior.

### 18.4 React tests

- completed lessons are clickable;
- current and viewed items remain visually distinct;
- locked item explanation is visible;
- optional work does not block primary CTA;
- one CTA is rendered from `nextAction`;
- review mode offers return-to-current navigation;
- chapter assessment appears after prerequisite lessons complete.

### 18.5 End-to-end scenarios

1. Complete a reading-only lesson and continue.
2. Complete reading, fail required practice, retry, then continue.
3. Skip optional practice and continue.
4. Complete all required lessons, pass chapter assessment, unlock next chapter.
5. Reopen an earlier completed lesson, rerun/reset practice, and verify progression remains unchanged.
6. Restart the runtime and verify current lesson, chapter status, and best results persist.

## 19. Rollout sequence

1. Add domain types and pure requirement engine behind existing linear behavior.
2. Add storage schema and migrate existing progress.
3. Normalize Course Schema 1.0 into an implicit chapter.
4. Add Course Schema 1.1 chapter/assessment authoring support.
5. Expose navigation snapshot and `nextAction` APIs.
6. Replace manual completion UI with requirement-aware footer.
7. Replace numeric `syn-lesson-progress` with hierarchical navigation.
8. Add review mode and stable deep links.
9. Add chapter assessment runtime and UI.
10. Remove or formally deprecate the manual lesson-complete endpoint after compatibility coverage.

## 20. Acceptance criteria

The feature is complete when all of the following are true:

1. Existing flat courses load and progress without author changes.
2. A chapter course can define required/optional lessons and chapter assessments.
3. Lesson, chapter, and course completion are calculated only by the Go runtime.
4. Required lesson practices block lesson completion; optional practices do not.
5. Required chapter assessments block the next chapter; optional assessments do not.
6. The next chapter opens automatically when the current chapter completes.
7. Completed lessons remain clickable and open in review mode.
8. Reviewing or resetting a completed lesson never rolls back progression.
9. A later failed practice attempt does not erase a prior passing best result.
10. `syn-lesson-progress` distinguishes current progression, viewed item, completed, available, optional, and locked states.
11. React renders one backend-authored primary next action.
12. Progress survives runtime restart.
13. Migration, unit, API, React, and end-to-end tests cover the scenarios in this document.

## 21. Explicit invariants

```text
Viewing is never progression mutation.
Workspace state is not progression state.
Latest result is not best result.
Optional work never blocks required progression.
Completed state is monotonic for a fixed course version.
The Go runtime is the sole authority for unlock and completion.
```
