# Activity Engine authoring

Activity Engine v1 is the common execution model for lesson practice and chapter assessment. A lesson or assessment owns one or more activity sets. Each set defines ordering and policy; each activity file defines one learner interaction. Coding is one activity kind rather than the default shape of every practice.

## Activity set

```json
{
  "schemaVersion": "1.0",
  "id": "practice",
  "title": "Thực hành",
  "policy": {
    "purpose": "practice",
    "maxAttempts": null,
    "feedbackMode": "immediate",
    "revealAnswers": "after-submit",
    "scoring": "none",
    "passingScore": null
  },
  "activities": [{ "id": "question-1", "path": "question-1.activity.json", "required": true }]
}
```

`purpose` is `practice` or `assessment`. Practice normally allows unlimited attempts and immediate feedback. Assessment may limit attempts, delay feedback, award points, and define a passing score. `revealAnswers` accepts `never`, `after-submit`, or `after-final-attempt`.

## Attempt lifecycle

The browser loads the current attempt, keeps the learner answer locally, and may save a draft. Draft writes use optimistic revisions. Submission requires an idempotency key, creates an immutable submitted/evaluated record, and refreshes set progress plus course progression. Retrying creates a new attempt number rather than rewriting a submitted answer.

The public activity payload never contains answer keys. Correct answers remain inside the Go evaluator registry and are copied to feedback only when the set reveal policy permits it.

## Completion and scoring

A required practice set is complete when every required activity satisfies its completion contract. Automatic activities complete when their evaluator passes. Writing v1 completes on a valid submission and deliberately does not invent an automatic score. Coding completes when its trusted check action records a passed terminal result.

For assessment sets, use `scoring: "points"` and a numeric `passingScore` when the included activities are automatically scorable. Submission-only writing must not be used to satisfy a numeric assessment threshold without a future rubric or review implementation.

## Owner-scoped runtime

Every API path includes course and owner identity. Owners are lessons or assessments. This prevents activities with the same ID in different lessons from sharing attempts or coding workspaces. The canonical shapes are conceptually:

```text
courses/:courseId/lessons/:lessonId/activity-sets
courses/:courseId/lessons/:lessonId/activities/:activityId/attempts/current
courses/:courseId/assessments/:assessmentId/activity-sets
courses/:courseId/assessments/:assessmentId/activities/:activityId/attempts/current
```

## Authoring workflow

1. Create activity files beside an activity-set manifest.
2. Reference every activity exactly once from the set.
3. Add the set path to lesson front matter or an assessment manifest.
4. Embed selected activity IDs in Markdown when their location matters.
5. Run `pnpm course:validate <course-path>`.
6. Preview with the native runtime and test keyboard-only completion.

See `activity-kinds.md` for exact v1 configurations and the multi-domain example for a complete package.
