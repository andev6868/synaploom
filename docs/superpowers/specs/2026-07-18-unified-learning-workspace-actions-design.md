# Unified Learning Workspace and Progression Actions Design

## Goal

Make lesson and chapter-assessment experiences feel like one continuous learning flow, remove redundant in-content navigation elements, and ensure the footer action always describes the real next learning step.

## Scope

This change covers three connected concerns:

1. Remove `syn-review-banner` and `syn-breadcrumb` from lesson content.
2. Correct the progression action state machine and remove the non-functional course-summary action.
3. Render chapter assessments inside the same Learning Workspace Shell used by lessons.

The progression API, canonical lesson routes, canonical assessment routes, and top navigation shell remain the source of navigation context.

## User Experience

### Lesson content

A lesson starts directly with its status, title, progress summary, and content. The top application shell already shows the course, chapter, current item, curriculum, and previous/next controls, so the lesson body must not repeat that information.

The following elements are removed:

- `ReviewBanner`
- `.syn-review-banner`
- the breadcrumb `<nav>`
- `.syn-breadcrumb`

Review mode remains visible through the lesson status treatment and the footer action. A completed lesson opened for review displays `Đang xem lại` as its status rather than adding a separate banner.

### Progression footer

The footer is the single in-content source of completion requirements and progression actions.

Requirement labels use learner-facing titles and never expose raw IDs. The footer action is rendered as a visually explicit button only when a real action exists.

Action copy follows these rules:

| Backend action | Learner-facing action |
|---|---|
| `ACKNOWLEDGE_READING` | `Đánh dấu đã đọc` |
| `START_REQUIRED_PRACTICE` | `Mở bài thực hành` |
| `RETRY_REQUIRED_PRACTICE` | `Thử lại bài thực hành` |
| `CONTINUE_TO_LESSON` | `Tiếp tục bài {lesson title}` |
| `RETURN_TO_CURRENT_LESSON` | `Tiếp tục bài {lesson title}` |
| `START_CHAPTER_ASSESSMENT` | `Bắt đầu đánh giá chương` |
| `RETRY_CHAPTER_ASSESSMENT` | `Làm lại đánh giá chương` |
| `CONTINUE_TO_CHAPTER` | `Tiếp tục chương {chapter title}` |
| `VIEW_COURSE_SUMMARY` | no button; render `Bạn đã hoàn thành khóa học` |
| `NONE` | no button |

`RETURN_TO_CURRENT_LESSON` retains its protocol name for compatibility, but its UI meaning is “resume the current progression target,” not “go backward.” It must therefore use `Tiếp tục`, never `Quay lại`.

The frontend resolves lesson and chapter titles from course navigation data. If a title cannot be resolved, it uses a generic but accurate label such as `Tiếp tục bài học`; it must not display an ID.

`VIEW_COURSE_SUMMARY` remains parseable for backward compatibility, but the runtime stops emitting it until a real course-summary surface exists. Existing payloads containing it render a completion message without navigation.

### Assessment continuity

Assessment URLs remain canonical and deep-linkable:

```text
/courses/:courseId/chapters/:chapterId/assessments/:assessmentId
```

However, the assessment is no longer rendered by an isolated application page. It is rendered as another learning item inside the shared Learning Workspace Shell.

The shell remains stable while moving between lessons and assessments:

- same `AppHeader`
- same top learning navigation
- same curriculum popover
- same previous/next controls
- same course and chapter context
- same loading and error surfaces
- same AI assistant area

For the current quiz/form assessment model, the assessment replaces the lesson/practice body with a focused full-width assessment surface. No empty editor or terminal panel is displayed. A future assessment may opt into a split workspace through an explicit workspace exercise declaration, but that is outside this change.

The assessment surface contains:

1. assessment status and title
2. learner-facing requirements
3. current/best result when available
4. the assessment submission/check action
5. the shared progression footer after completion or when another progression action is available

After an assessment submission, the application invalidates and reloads both assessment state and course navigation state. This allows the same top shell and footer to immediately expose the next chapter, next lesson, or course-complete state.

## Architecture

### Route composition

`App.tsx` continues to parse lesson and assessment URLs, but both route kinds render `LearningWorkspacePage` with a discriminated route descriptor:

```ts
type LearningWorkspaceRoute =
  | {
      readonly kind: 'lesson';
      readonly courseId?: string;
      readonly chapterId?: string;
      readonly lessonId: string | null;
    }
  | {
      readonly kind: 'assessment';
      readonly courseId: string;
      readonly chapterId: string;
      readonly assessmentId: string;
    };
```

`LearningWorkspacePage` becomes the application-shell composition root. It owns common course, navigation, pane preference, loading, error, header, and navigation behavior.

### Item-specific content

The shared shell delegates body rendering to focused components:

- `LessonWorkspaceContent` loads and renders lesson content, practice, and lesson requirements.
- `AssessmentWorkspaceContent` loads and renders assessment content, assessment checking, results, and progression state.

Each content component exposes the viewed item ID and uses the same navigation callbacks supplied by the shell.

### Shared progression action resolver

A pure function resolves display text and behavior metadata from `NextActionPayload` plus course navigation:

```ts
type ProgressionActionPresentation =
  | {
      readonly kind: 'button';
      readonly label: string;
      readonly action: NextActionPayload;
    }
  | {
      readonly kind: 'complete';
      readonly message: string;
    }
  | { readonly kind: 'none' };
```

This resolver is shared by lesson and assessment footers. It is the only place that maps protocol action types to learner-facing text.

### Backend action semantics

The progression service changes its terminal course behavior from `VIEW_COURSE_SUMMARY` to `NONE`. Course completion remains visible through course/navigation status and the compatibility presentation rule described above.

No schema-breaking protocol change is required in this slice. Removing `VIEW_COURSE_SUMMARY` from generated contracts is deferred to a dedicated contract migration.

## Data Flow

### Lesson

```text
route
→ shared shell loads course and navigation
→ lesson content loads canonical or legacy lesson
→ lesson context provides requirements and nextAction
→ shared action resolver creates footer presentation
→ user action mutates reading/completion or navigates
→ course, lesson, and navigation queries invalidate
```

### Assessment

```text
assessment route
→ shared shell loads course and navigation
→ assessment content loads assessment payload
→ user submits assessment
→ assessment mutation persists result
→ assessment and navigation queries invalidate
→ navigation nextAction is resolved by shared footer
→ user continues without leaving the workspace shell
```

## Error Handling

- Common course/navigation failures use the existing shared `Không thể mở...` error surface.
- Assessment fetch failures identify the assessment as the failed learning item without tearing down the application shell.
- Locked assessments remain visible in top navigation but cannot be submitted.
- A missing target title never exposes a raw identifier; the UI falls back to a generic action label.
- A malformed navigation target must not generate an empty canonical segment. Existing safe legacy fallback behavior remains in place.
- `VIEW_COURSE_SUMMARY` never changes `window.location.hash` and never creates a dead-end route.

## Accessibility

- The footer action remains a native `<button>` with visible hover and focus states.
- Course completion is announced as status text, not represented by a disabled or fake button.
- Assessment status and result updates use an appropriate live region.
- Top navigation retains `aria-current`, disabled-state semantics, and keyboard interaction for assessments.
- Removing breadcrumb and review banner must not remove the page’s accessible heading hierarchy; each lesson or assessment retains exactly one `<h1>`.

## Styling

Remove obsolete styles:

- `.syn-breadcrumb`
- `.syn-review-banner`
- standalone `.syn-assessment-page` layout rules

Add or adapt shared workspace item styles for:

- full-width assessment surface
- assessment result block
- course-complete footer state
- review status badge

The assessment body must use the same width, spacing, typography, and scroll ownership as reading-only lesson content.

## Testing Strategy

### Unit and DOM tests

1. A reviewed lesson renders no review banner and no breadcrumb.
2. Review mode uses the `Đang xem lại` status treatment.
3. `RETURN_TO_CURRENT_LESSON` resolves to `Tiếp tục bài Event Loop`.
4. `CONTINUE_TO_LESSON` resolves to the same forward-progress language.
5. Missing target titles produce a generic label, not an ID.
6. `VIEW_COURSE_SUMMARY` renders a completion message and no button.
7. `App` renders assessment routes through `LearningWorkspacePage`.
8. An assessment route retains the top navigation and AI assistant.
9. Assessment completion invalidates assessment and navigation queries.
10. Assessment previous/next navigation uses the same shell callbacks as lessons.

### Go tests

1. Completed course progression returns `NextActionNone` rather than `NextActionViewCourseSummary`.
2. Review and continue targets retain valid course/chapter/item identities.
3. Existing progression routes remain unchanged.

### Manual verification

1. Open lesson 1, complete it, and confirm the CTA says `Tiếp tục bài Event Loop`.
2. Open lesson 1 in review mode and confirm there is no banner or breadcrumb.
3. Navigate to the chapter assessment and confirm the header does not remount or disappear.
4. Complete the assessment and confirm the next progression action appears in the same workspace.
5. Complete the course and confirm a completion message appears without a non-functional summary button.

## Non-goals

- Building a course-summary/dashboard page.
- Removing `VIEW_COURSE_SUMMARY` from generated protocol contracts.
- Adding coding workspaces to assessments.
- Redesigning the assessment question model.
- Changing canonical route formats.
