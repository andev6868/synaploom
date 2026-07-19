# Activity kinds

All activity files include `schemaVersion`, `id`, `kind`, `title`, a typed `prompt`, `config`, `evaluation`, and `completion`. The snippets below focus on the fields that vary by kind.

## single-choice

```json
{
  "kind": "single-choice",
  "config": {
    "options": [
      { "id": "a", "label": "A" },
      { "id": "b", "label": "B" }
    ],
    "correctOptionId": "a",
    "randomize": false
  },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

The answer is `{ "kind": "single-choice", "optionId": "a" }`.

## multiple-choice

```json
{
  "kind": "multiple-choice",
  "config": {
    "options": [
      { "id": "a", "label": "A" },
      { "id": "b", "label": "B" }
    ],
    "correctOptionIds": ["a", "b"],
    "evaluationMode": "exact-set",
    "randomize": false
  },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

Use `partial-credit` only when penalized partial selection is pedagogically appropriate.

## true-false

```json
{
  "kind": "true-false",
  "config": { "expected": true },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

The answer contains a boolean `value`.

## short-answer

```json
{
  "kind": "short-answer",
  "config": {
    "acceptedAnswers": ["hòn lửa"],
    "caseSensitive": false,
    "trimWhitespace": true,
    "matchMode": "exact"
  },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

Accepted match modes are validated by the runtime. Prefer normalized exact answers for objective recall; do not use keyword matching as a substitute for essay evaluation.

## fill-blanks

```json
{
  "kind": "fill-blanks",
  "config": {
    "template": "___, how are you?",
    "blanks": [{ "id": "greeting", "acceptedAnswers": ["hello"], "caseSensitive": false }]
  },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

The answer is a `values` map keyed by blank ID.

## ordering

```json
{
  "kind": "ordering",
  "config": {
    "items": [
      { "id": "read", "label": "Read" },
      { "id": "compute", "label": "Compute" }
    ],
    "correctOrder": ["read", "compute"],
    "scoringMode": "exact"
  },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

The web renderer provides keyboard-accessible move-up and move-down controls; drag and drop is not required.

## matching

```json
{
  "kind": "matching",
  "config": {
    "left": [{ "id": "book", "label": "book" }],
    "right": [{ "id": "sach", "label": "sách" }],
    "correctMatches": { "book": "sach" }
  },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

The canonical answer field is `pairs`, for example `{ "kind": "matching", "pairs": { "book": "sach" } }`. Matches must be one-to-one.

## numeric

```json
{
  "kind": "numeric",
  "config": { "expected": "4", "tolerance": 0, "unit": null, "requireUnit": false },
  "evaluation": { "mode": "automatic", "points": 1 },
  "completion": { "required": true }
}
```

Numeric input is transported as a string so decimal and expression syntax is not lost before the trusted evaluator parses it. Configure tolerance and units explicitly.

## writing

```json
{
  "kind": "writing",
  "config": {
    "minimumCharacters": 40,
    "maximumCharacters": 500,
    "answerFormat": "safe-markdown",
    "outlinePrompts": ["Claim", "Evidence", "Explanation"]
  },
  "evaluation": { "mode": "submission", "points": 0 },
  "completion": { "required": true }
}
```

`answerFormat` is `plain-text` or `safe-markdown`. Version 1 records a valid submission but does not auto-grade prose.

## coding

```json
{
  "kind": "coding",
  "config": {
    "workspace": { "starter": "starter", "editable": ["main.js"] },
    "actions": {
      "check": {
        "label": "Kiểm tra kết quả",
        "executable": "node",
        "args": ["checks/check.mjs"],
        "timeoutMs": 10000,
        "maxOutputBytes": 65536
      }
    }
  },
  "evaluation": { "mode": "trusted-action", "points": 1 },
  "completion": { "required": true }
}
```

The browser submits an allowlisted action ID, never a command string. The Go runtime resolves the executable and arguments, runs inside an isolated owner/activity workspace, bounds output and time, and records the execution ID as the attempt idempotency key.

Activity Engine v1 does not yet include speech scoring, recording, diagram hotspots, geometry construction, peer review, AI rubric grading, or general-purpose simulations. Those capabilities require separate privacy, sandbox, accessibility, and evaluator designs.
