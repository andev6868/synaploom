# Contextual AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent bottom AI dock with zero-footprint contextual Quick Ask entry points for Theory and Practice, selection-aware context, and a temporary expanded conversation panel.

**Architecture:** Keep the daemon authoritative for lesson, assessment, activity, attempt, file, and check context. The browser sends an owner-qualified request containing only intent, source, bounded identifiers, prompt, and optional normalized selected text; a workspace-level React controller owns invocation, drafts, request identity, messages, focus restoration, and presentation state. Contextual overlays mount above the existing Theory/Practice/Navigator grid and never participate in grid sizing.

**Tech Stack:** React 19, TypeScript 6, TanStack Query 5, Vitest 4, Testing Library, CSS, Go `net/http`, existing Synaploom AI provider abstraction, Playwright 1.61.

## Global Constraints

- AI occupies zero permanent workspace area while closed.
- The default layout remains `Theory | Practice | Activity Navigator`.
- Activity Navigator remains dedicated to navigation and progress; it must not contain an AI tab or chat surface.
- The persistent entry points are `Hỏi AI` in Theory and `Hỏi AI` in the Practice header.
- Selection Context supplements the persistent triggers and never replaces them.
- Theory selected text is normalized and capped at exactly 2,000 Unicode code points.
- Practice item context uses an explicit action separate from drag handles, answer controls, and submission actions.
- The browser never sends arbitrary filesystem content, complete lesson documents, complete attempt objects, provider credentials, or daemon-constructed context.
- The daemon validates course, owner, chapter, activity, and source relationships before invoking the provider.
- Only one AI generation request may be active per workspace controller.
- Streaming responses are outside the first implementation; the daemon aggregates provider events into one response.
- AI must not submit, reorder, edit, check, complete, or grade an activity.
- Closing the assistant or changing invocation prevents stale responses from being applied.
- AI disabled, validation failure, or provider failure never blocks Theory reading, Practice editing, saving, checking, navigation, or completion.
- Expanded desktop conversation overlays Navigator and part of Practice; it never resizes the workspace grid.
- Mobile Quick Ask is a bottom sheet; mobile expanded conversation is a full-screen modal dialog.
- No cross-session conversation persistence and no cross-course learner memory.
- Do not add a new runtime dependency; implement anchoring with DOM geometry, CSS, and existing React/Radix primitives.
- Every production change starts with a failing focused test, passes focused verification, and ends with a commit.

---

## File ownership map

| File or area | Responsibility |
| --- | --- |
| `packages/ai-contracts/src/index.ts` | Browser command, owner-qualified target, response, and source types. |
| `internal/server/ai_context.go` | Validation, selected-text normalization, and daemon-owned trusted context construction. |
| `internal/server/ai_handlers.go` | Owner-qualified non-streaming generation endpoint and localized errors. |
| `internal/server/router.go` | Route registration and injection of course/progression/activity services. |
| `apps/web/src/shared/api/client.ts` | Owner-qualified AI transport. |
| `apps/web/src/features/ai-assistant/contextual-assistant-model.ts` | Invocation, surface, message, and request-state types. |
| `apps/web/src/features/ai-assistant/useContextualAssistant.ts` | Controller, request identity, drafts, messages, abort/stale protection, and focus restoration. |
| `apps/web/src/features/ai-assistant/AssistantTrigger.tsx` | Reusable source-labelled entry action. |
| `apps/web/src/features/ai-assistant/AssistantContextBadge.tsx` | Visible source/target identity. |
| `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx` | Short response UI and source-specific actions. |
| `apps/web/src/features/ai-assistant/AssistantConversationPanel.tsx` | Expanded multi-turn desktop/mobile surface. |
| `apps/web/src/features/ai-assistant/AssistantSelectionToolbar.tsx` | Theory selection action anchored to the selection rectangle. |
| `apps/web/src/features/ai-assistant/useTheoryAssistantSelection.ts` | Selection validation, normalization, anchor calculation, Escape/focus cleanup. |
| `apps/web/src/features/ai-assistant/ContextualAssistantLayer.tsx` | Composes trigger invocations, popover, panel, and responsive presentation. |
| `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx` | One controller per lesson/assessment composition and owner target wiring. |
| `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx` | Removes permanent assistant slot and exposes overlay mounting boundary. |
| `apps/web/src/features/learning-workspace/PracticePane.tsx` | Practice invocation callback plumbing. |
| `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx` | Persistent Practice `Hỏi AI` trigger. |
| `apps/web/src/features/lesson-content/LessonActivities.tsx` | Theory selection zone and Theory trigger placement. |
| `apps/web/src/features/activity-engine/types.ts` | Narrow practice-item AI callback contract. |
| `apps/web/src/features/activity-engine/ActivityHost.tsx` | Passes item-context callbacks to supported renderers. |
| `apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx` | Explicit `Hỏi AI về bước này` action without answer mutation. |
| `apps/web/src/application.css` | Contextual assistant geometry, overlay, responsive, focus, and reduced-motion rules; removes dock layout rules. |
| `packages/ui/src/styles.css` and `packages/ui/src/index.ts` | Retires AssistantDock export/styles when no consumer remains. |
| `tests/e2e/single-active-workspace-go-runtime.spec.ts` | Zero-footprint, anchoring, overlay/no-reflow, selection, focus, and mobile contracts. |

---

### Task 1: Define the owner-qualified AI command contract

**Files:**

- Modify: `packages/ai-contracts/src/index.ts`
- Modify: `packages/ai-contracts/src/disabled-provider.test.ts`
- Modify: `apps/web/src/shared/api/client.ts`
- Create: `apps/web/src/shared/api/client.ai.test.ts`

**Interfaces:**

- Produces: `AiContextSource = 'theory' | 'practice'`.
- Produces: `AiWorkspaceTarget` with `courseId`, `ownerKind`, `ownerId`, and optional `chapterId`.
- Produces: `AiGenerateCommand` with `kind`, `prompt`, `source`, optional `activityId`, and optional `selectedText`.
- Changes: `SynaploomApiClient.requestAi(target, command)`.

- [ ] **Step 1: Write the failing transport test**

Create `apps/web/src/shared/api/client.ai.test.ts`:

```ts
import { expect, it, vi } from 'vitest';
import { createApiClient } from '#src/shared/api/client';

it('posts bounded AI context to the owner-qualified route', async () => {
  const fetchImpl = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ status: 'ok', content: 'Giải thích' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  const client = createApiClient(fetchImpl as typeof fetch);

  await client.requestAi(
    {
      courseId: 'course',
      ownerKind: 'lessons',
      ownerId: 'lesson-1',
      chapterId: 'chapter-1',
    },
    {
      kind: 'explain',
      prompt: 'Giải thích đoạn này',
      source: 'theory',
      selectedText: 'Đoạn được chọn',
    },
  );

  expect(fetchImpl).toHaveBeenCalledWith(
    '/api/v1/courses/course/lessons/lesson-1/ai/generate?chapterId=chapter-1',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        kind: 'explain',
        prompt: 'Giải thích đoạn này',
        source: 'theory',
        selectedText: 'Đoạn được chọn',
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run --project node apps/web/src/shared/api/client.ai.test.ts
```

Expected: FAIL because `requestAi` currently accepts only one argument and posts to `/api/v1/ai/generate`.

- [ ] **Step 3: Add the exact contract types**

Replace the browser command section in `packages/ai-contracts/src/index.ts` with:

```ts
export type AiContextSource = 'theory' | 'practice';

export interface AiWorkspaceTarget {
  readonly courseId: string;
  readonly ownerKind: 'lessons' | 'assessments';
  readonly ownerId: string;
  readonly chapterId?: string;
}

/** Browser command. Trusted lesson/activity context is generated only by the daemon. */
export interface AiGenerateCommand {
  readonly kind: AiRequestKind;
  readonly prompt: string;
  readonly source: AiContextSource;
  readonly activityId?: string;
  readonly selectedText?: string;
}
```

Keep `AiRequest`, `AiResponse`, and `AiProvider` unchanged.

- [ ] **Step 4: Change the API client signature and route builder**

Update `SynaploomApiClient`:

```ts
requestAi(target: AiWorkspaceTarget, command: AiGenerateCommand): Promise<AiResponse>;
```

Add this helper beside `activityOwnerPath`:

```ts
function aiWorkspacePath(target: AiWorkspaceTarget): string {
  const base = `/courses/${encodeURIComponent(target.courseId)}/${target.ownerKind}/${encodeURIComponent(target.ownerId)}/ai/generate`;
  if (!target.chapterId) return base;
  return `${base}?chapterId=${encodeURIComponent(target.chapterId)}`;
}
```

Replace the implementation with:

```ts
requestAi: (target, command) =>
  request<AiResponse>(fetchImpl, api(aiWorkspacePath(target)), {
    method: 'POST',
    body: JSON.stringify(command),
  }),
```

Import `AiWorkspaceTarget` from `@synaploom/ai-contracts`.

- [ ] **Step 5: Update the disabled-provider test fixture**

Keep provider request construction explicit:

```ts
await provider.generate(
  {
    kind: 'explain',
    lessonId: 'lesson',
    prompt: 'why',
    context: { lessonText: '' },
  },
  new AbortController().signal,
);
```

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run --project node \
  apps/web/src/shared/api/client.ai.test.ts \
  packages/ai-contracts/src/disabled-provider.test.ts
pnpm --filter @synaploom/ai-contracts typecheck
```

Expected: both tests PASS and the AI-contracts typecheck exits `0`. The web-wide typecheck is deferred until all typed fake clients are migrated in Task 11.

- [ ] **Step 7: Commit**

```bash
git add packages/ai-contracts/src/index.ts \
  packages/ai-contracts/src/disabled-provider.test.ts \
  apps/web/src/shared/api/client.ts \
  apps/web/src/shared/api/client.ai.test.ts
git commit -m "feat: define contextual AI command contract"
```

---

### Task 2: Build trusted daemon context and the generation endpoint

**Files:**

- Create: `internal/server/ai_context.go`
- Create: `internal/server/ai_context_test.go`
- Modify: `internal/server/ai_handlers.go`
- Create: `internal/server/ai_handlers_test.go`
- Modify: `internal/server/router.go`

**Interfaces:**

- Produces: `normalizeAISelectedText(string) (string, error)`.
- Produces: `aiContextBuilder.build(context.Context, aiOwner, aiGeneratePayload) (ai.Request, error)`.
- Produces: `POST /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/ai/generate`.
- Preserves: existing `/api/v1/ai/disclosure` and `/api/v1/ai/stream` routes.

- [ ] **Step 1: Write RED selected-text and source validation tests**

Create `internal/server/ai_context_test.go`:

```go
package server

import (
	"strings"
	"testing"
)

func TestNormalizeAISelectedTextUsesUnicodeLimit(t *testing.T) {
	input := strings.Repeat("界", 2001)
	_, err := normalizeAISelectedText(input)
	if err == nil {
		t.Fatal("expected selected text limit error")
	}

	got, err := normalizeAISelectedText("  dòng một\r\n\r\n  dòng hai  ")
	if err != nil {
		t.Fatal(err)
	}
	if got != "dòng một\n\ndòng hai" {
		t.Fatalf("got %q", got)
	}
}

func TestValidateAIPayloadRejectsCrossSourceActivity(t *testing.T) {
	err := validateAIPayload(aiGeneratePayload{
		Kind: "explain", Prompt: "why", Source: "theory", ActivityID: "a1",
	})
	if err == nil {
		t.Fatal("expected theory activityId validation error")
	}
}
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/server -run 'TestNormalizeAISelectedText|TestValidateAIPayload' -count=1
```

Expected: build FAIL because the payload and helpers do not exist.

- [ ] **Step 3: Implement payload validation and normalization**

Create `internal/server/ai_context.go` with these public-in-package definitions:

```go
package server

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/ai"
	"github.com/synaploom/synaploom/internal/course"
)

var errAIContextInvalid = errors.New("AI context is invalid")

type aiGeneratePayload struct {
	Kind         string `json:"kind"`
	Prompt       string `json:"prompt"`
	Source       string `json:"source"`
	ActivityID   string `json:"activityId,omitempty"`
	SelectedText string `json:"selectedText,omitempty"`
}

type aiOwner struct {
	CourseID      string
	CourseVersion string
	OwnerKind     activity.OwnerKind
	OwnerID       string
	ChapterID     string
}

type aiContextBuilder struct {
	content     course.Service
	progression LearningProgression
	activities  activity.Service
}

func normalizeAISelectedText(value string) (string, error) {
	normalized := strings.TrimSpace(strings.ReplaceAll(value, "\r\n", "\n"))
	lines := strings.Split(normalized, "\n")
	for index := range lines {
		lines[index] = strings.TrimSpace(lines[index])
	}
	normalized = strings.TrimSpace(strings.Join(lines, "\n"))
	if utf8.RuneCountInString(normalized) > 2000 {
		return "", errAIContextInvalid
	}
	return normalized, nil
}

func validateAIPayload(payload aiGeneratePayload) error {
	if strings.TrimSpace(payload.Prompt) == "" || utf8.RuneCountInString(payload.Prompt) > 4000 {
		return errAIContextInvalid
	}
	switch payload.Kind {
	case "explain", "hint", "summarize", "explain-check-failure":
	default:
		return errAIContextInvalid
	}
	switch payload.Source {
	case "theory":
		if payload.ActivityID != "" {
			return errAIContextInvalid
		}
	case "practice":
		if payload.ActivityID == "" {
			return errAIContextInvalid
		}
	default:
		return errAIContextInvalid
	}
	if _, err := normalizeAISelectedText(payload.SelectedText); err != nil {
		return err
	}
	return nil
}

func jsonContextItem(kind, name string, value any) (ai.ContextItem, error) {
	content, err := json.Marshal(value)
	if err != nil {
		return ai.ContextItem{}, err
	}
	return ai.ContextItem{Kind: kind, Name: name, Content: string(content)}, nil
}

func (b aiContextBuilder) build(ctx context.Context, owner aiOwner, payload aiGeneratePayload) (ai.Request, error) {
	if err := validateAIPayload(payload); err != nil {
		return ai.Request{}, err
	}
	selectedText, _ := normalizeAISelectedText(payload.SelectedText)
	items := make([]ai.ContextItem, 0, 4)

	if owner.OwnerKind == activity.OwnerKindLesson {
		lesson, err := b.content.Lesson(ctx, owner.OwnerID)
		if err != nil {
			return ai.Request{}, errAIContextInvalid
		}
		item, err := jsonContextItem("lesson", lesson.Title, lesson.Blocks)
		if err != nil {
			return ai.Request{}, err
		}
		items = append(items, item)
	} else {
		if b.progression == nil || owner.ChapterID == "" {
			return ai.Request{}, errAIContextInvalid
		}
		assessment, err := b.progression.ChapterAssessment(ctx, owner.ChapterID, owner.OwnerID)
		if err != nil {
			return ai.Request{}, errAIContextInvalid
		}
		item, err := jsonContextItem("assessment", assessment.Assessment.Title, assessment.Assessment)
		if err != nil {
			return ai.Request{}, err
		}
		items = append(items, item)
	}

	if selectedText != "" {
		items = append(items, ai.ContextItem{Kind: "selection", Name: payload.Source, Content: selectedText})
	}

	if payload.Source == "practice" {
		if b.activities == nil {
			return ai.Request{}, errAIContextInvalid
		}
		identity := activity.OwnerIdentity{
			CourseID: owner.CourseID, CourseVersion: owner.CourseVersion,
			Kind: owner.OwnerKind, ID: owner.OwnerID,
		}
		view, err := b.activities.PublicActivity(ctx, identity, payload.ActivityID)
		if err != nil {
			return ai.Request{}, errAIContextInvalid
		}
		activityItem, err := jsonContextItem("activity", view.Title, view)
		if err != nil {
			return ai.Request{}, err
		}
		items = append(items, activityItem)
		attempt, err := b.activities.CurrentAttempt(ctx, activity.AttemptIdentity{
			Owner: identity, ActivityID: payload.ActivityID,
		})
		if err != nil {
			return ai.Request{}, errAIContextInvalid
		}
		if attempt != nil {
			attemptItem, err := jsonContextItem("attempt", payload.ActivityID, attempt)
			if err != nil {
				return ai.Request{}, err
			}
			items = append(items, attemptItem)
		}
	}

	return ai.Request{Question: strings.TrimSpace(payload.Prompt), ContextItems: items}, nil
}
```

- [ ] **Step 4: Add RED handler tests for trusted context and invalid activity**

Create `internal/server/ai_handlers_test.go` using the existing server test stubs and a capture provider:

```go
package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/synaploom/synaploom/internal/ai"
)

type captureAIProvider struct{ request ai.Request }

func (p *captureAIProvider) Stream(_ context.Context, request ai.Request) (<-chan ai.Event, error) {
	p.request = request
	ch := make(chan ai.Event, 2)
	ch <- ai.Event{Type: "ai.delta", Content: "Xin "}
	ch <- ai.Event{Type: "ai.delta", Content: "chào"}
	close(ch)
	return ch, nil
}

func newAIRouterFixture(t *testing.T, provider ai.Provider) (http.Handler, *SessionManager) {
	t.Helper()
	content, err := course.NewMemoryReference(
		[]byte(courseFixture),
		map[string][]byte{"main-thread": []byte(lessonFixture)},
	)
	if err != nil {
		t.Fatal(err)
	}
	activities := &stubActivityService{
		public: activity.PublicActivityView{
			ID: "quiz", Kind: activity.ActivityKindOrdering, Title: "Sắp xếp",
			Prompt: map[string]any{"blocks": []any{}},
			Config: map[string]any{"items": []any{}},
			Evaluation: activity.EvaluationPolicy{Mode: activity.EvaluationModeAutomatic, Points: 1},
			Completion: activity.CompletionPolicy{Required: true},
		},
	}
	sessions := NewSessionManager()
	return NewRouter(
		content, sessions, WithActivities(activities), WithAI(provider, true),
	), sessions
}

func TestAIGenerateAggregatesProviderEvents(t *testing.T) {
	provider := &captureAIProvider{}
	router, sessions := newAIRouterFixture(t, provider)
	cookie := authenticatedCookie(t, router, sessions)
	body := `{"kind":"explain","prompt":"Giải thích","source":"theory","selectedText":"đoạn"}`
	req := httptest.NewRequest(
		http.MethodPost,
		"http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/ai/generate",
		strings.NewReader(body),
	)
	req.Host = "127.0.0.1:3210"
	req.AddCookie(cookie)
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["status"] != "ok" || payload["content"] != "Xin chào" {
		t.Fatalf("payload=%#v", payload)
	}
	if len(provider.request.ContextItems) == 0 {
		t.Fatal("daemon context was not constructed")
	}
}
```

- [ ] **Step 5: Implement the owner-qualified handler**

Replace `aiHandlers` with:

```go
type aiHandlers struct {
	provider ai.Provider
	local    bool
	builder  aiContextBuilder
}
```

Add:

```go
func (h aiHandlers) generate(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	decoder.DisallowUnknownFields()
	var payload aiGeneratePayload
	if err := decoder.Decode(&payload); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "AI_REQUEST_INVALID", "Yêu cầu Trợ lý AI không hợp lệ.", requestID(r), nil)
		return
	}
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	request, err := h.builder.build(r.Context(), owner, payload)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "AI_CONTEXT_INVALID", "Ngữ cảnh Trợ lý AI không hợp lệ.", requestID(r), nil)
		return
	}
	events, err := h.provider.Stream(r.Context(), request)
	if err != nil {
		writeError(w, http.StatusBadGateway, "AI_PROVIDER_ERROR", "Trợ lý AI hiện không thể phản hồi. Hãy thử lại.", requestID(r), nil)
		return
	}
	var content strings.Builder
	for event := range events {
		switch event.Type {
		case "ai.delta":
			content.WriteString(event.Content)
		case "ai.unavailable":
			writeJSON(w, map[string]any{"status": "disabled", "message": "Trợ lý AI chưa được cấu hình."})
			return
		case "ai.error":
			writeError(w, http.StatusBadGateway, "AI_PROVIDER_ERROR", "Trợ lý AI hiện không thể phản hồi. Hãy thử lại.", requestID(r), nil)
			return
		}
	}
	writeJSON(w, map[string]any{"status": "ok", "content": content.String()})
}
```

Add this method to `ai_handlers.go`:

```go
func (h aiHandlers) owner(w http.ResponseWriter, r *http.Request) (aiOwner, bool) {
	coursePayload, err := h.builder.content.Course(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
		return aiOwner{}, false
	}
	if coursePayload.Id != r.PathValue("courseId") {
		writeError(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Không tìm thấy khóa học.", requestID(r), nil)
		return aiOwner{}, false
	}
	owner := aiOwner{
		CourseID: coursePayload.Id, CourseVersion: coursePayload.Version,
		OwnerID: r.PathValue("ownerId"), ChapterID: r.URL.Query().Get("chapterId"),
	}
	switch r.PathValue("ownerKind") {
	case "lessons":
		owner.OwnerKind = activity.OwnerKindLesson
	case "assessments":
		owner.OwnerKind = activity.OwnerKindAssessment
		if owner.ChapterID == "" {
			writeError(w, http.StatusUnprocessableEntity, "AI_CONTEXT_INVALID", "Ngữ cảnh Trợ lý AI không hợp lệ.", requestID(r), nil)
			return aiOwner{}, false
		}
	default:
		writeError(w, http.StatusBadRequest, "AI_OWNER_INVALID", "Loại nội dung học không hợp lệ.", requestID(r), nil)
		return aiOwner{}, false
	}
	return owner, true
}
```

- [ ] **Step 6: Register the route with trusted services**

In `NewRouter`, construct:

```go
h := aiHandlers{
	provider: configuration.aiProvider,
	local: configuration.aiLocal,
	builder: aiContextBuilder{
		content: service,
		progression: configuration.progression,
		activities: configuration.activities,
	},
}
api.HandleFunc("POST /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/ai/generate", h.generate)
```

Keep the current disclosure and stream routes registered.

- [ ] **Step 7: Run focused Go verification**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/server ./internal/ai -run 'AI|NormalizeAI|ValidateAI' -count=1
```

Expected: PASS with no provider call for invalid context and one aggregated response for valid context.

- [ ] **Step 8: Commit**

```bash
git add internal/server/ai_context.go \
  internal/server/ai_context_test.go \
  internal/server/ai_handlers.go \
  internal/server/ai_handlers_test.go \
  internal/server/router.go
git commit -m "feat: build trusted contextual AI requests"
```

---

### Task 3: Create the contextual assistant state model and controller

**Files:**

- Create: `apps/web/src/features/ai-assistant/contextual-assistant-model.ts`
- Create: `apps/web/src/features/ai-assistant/useContextualAssistant.ts`
- Create: `apps/web/src/features/ai-assistant/useContextualAssistant.test.tsx`

**Interfaces:**

- Produces: `AssistantInvocation`, `AssistantSurfaceState`, `AssistantMessage`, `ContextualAssistantController`.
- Produces: `useContextualAssistant({ target })`.
- Consumes: `SynaploomApiClient.requestAi(target, command)`.

- [ ] **Step 1: Write RED controller tests**

Create tests for open, request, stale-response protection, draft preservation, expand, close, and focus restoration:

```tsx
function theoryInvocation(anchor: HTMLElement): AssistantInvocation {
  return { source: 'theory', sectionTitle: 'Thuật toán', anchor };
}

function practiceInvocation(anchor: HTMLElement): AssistantInvocation {
  return {
    source: 'practice', activityId: 'ordering', activityTitle: 'Sắp xếp thuật toán', anchor,
  };
}

it('ignores a response after invocation changes', async () => {
  const first = deferred<AiResponse>();
  const requestAi = vi.fn().mockReturnValueOnce(first.promise);
  const trigger = document.createElement('button');
  document.body.append(trigger);
  const { result } = renderHook(() =>
    useContextualAssistant({
      target: { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' },
    }),
    { wrapper: ({ children }) => <AppProviders api={apiWith(requestAi)}>{children}</AppProviders> },
  );

  act(() => result.current.openQuick(theoryInvocation(trigger)));
  act(() => result.current.setPrompt('Giải thích'));
  let submission!: Promise<void>;
  act(() => { submission = result.current.submit('explain'); });
  act(() => result.current.openQuick(practiceInvocation(trigger)));
  await act(async () => {
    first.resolve({ status: 'ok', content: 'stale' });
    await submission;
  });

  expect(result.current.messages).toHaveLength(0);
  expect(result.current.state.kind).toBe('quick');
  expect(result.current.state.kind === 'quick' && result.current.state.invocation.source).toBe(
    'practice',
  );
});
```

Also assert:

```tsx
expect(result.current.prompt).toBe('');
expect(trigger).toHaveFocus();
expect(requestAi).toHaveBeenCalledWith(target, {
  kind: 'explain',
  prompt: 'Giải thích',
  source: 'theory',
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/ai-assistant/useContextualAssistant.test.tsx
```

Expected: FAIL because the model and hook do not exist.

- [ ] **Step 3: Define the model exactly**

Create `contextual-assistant-model.ts`:

```ts
import type { AiRequestKind, AiWorkspaceTarget } from '@synaploom/ai-contracts';

export type AssistantInvocation =
  | {
      readonly source: 'theory';
      readonly sectionTitle?: string;
      readonly selectedText?: string;
      readonly anchor: HTMLElement | DOMRect;
    }
  | {
      readonly source: 'practice';
      readonly activityId: string;
      readonly activityTitle: string;
      readonly selectedText?: string;
      readonly anchor: HTMLElement | DOMRect;
    };

export type AssistantSurfaceState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'quick'; readonly invocation: AssistantInvocation }
  | { readonly kind: 'expanded'; readonly invocation: AssistantInvocation };

export interface AssistantMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly source: AssistantInvocation['source'];
  readonly contextLabel: string;
}

export interface ContextualAssistantController {
  readonly target: AiWorkspaceTarget;
  readonly state: AssistantSurfaceState;
  readonly prompt: string;
  readonly messages: readonly AssistantMessage[];
  readonly response: string | null;
  readonly status: 'idle' | 'submitting' | 'disabled' | 'error';
  readonly error: string | null;
  openQuick(invocation: AssistantInvocation): void;
  expand(): void;
  close(): void;
  setPrompt(value: string): void;
  submit(kind: AiRequestKind, promptOverride?: string): Promise<void>;
}
```

- [ ] **Step 4: Implement the controller with request identity**

Create `useContextualAssistant.ts` with this controller structure:

```ts
import type { AiRequestKind, AiResponse, AiWorkspaceTarget } from '@synaploom/ai-contracts';
import { useCallback, useRef, useState } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import type {
  AssistantInvocation,
  AssistantMessage,
  AssistantSurfaceState,
  ContextualAssistantController,
} from '#src/features/ai-assistant/contextual-assistant-model';

function contextLabel(invocation: AssistantInvocation): string {
  if (invocation.source === 'theory') {
    return invocation.selectedText
      ? 'Đoạn được chọn'
      : `Lý thuyết${invocation.sectionTitle ? ` · ${invocation.sectionTitle}` : ''}`;
  }
  return invocation.selectedText
    ? `Bước được chọn · ${invocation.activityTitle}`
    : `Bài tập · ${invocation.activityTitle}`;
}

function sameInvocation(left: AssistantInvocation, right: AssistantInvocation): boolean {
  return (
    left.source === right.source &&
    left.selectedText === right.selectedText &&
    (left.source === 'theory'
      ? right.source === 'theory' && left.sectionTitle === right.sectionTitle
      : right.source === 'practice' && left.activityId === right.activityId)
  );
}

export function useContextualAssistant({
  target,
}: {
  readonly target: AiWorkspaceTarget;
}): ContextualAssistantController {
  const api = useApi();
  const [state, setState] = useState<AssistantSurfaceState>({ kind: 'closed' });
  const [prompt, setPromptState] = useState('');
  const [messages, setMessages] = useState<readonly AssistantMessage[]>([]);
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<ContextualAssistantController['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const promptRef = useRef(prompt);
  const requestIdentityRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const draftsRef = useRef<Record<'theory' | 'practice', string>>({ theory: '', practice: '' });

  const replaceState = useCallback((next: AssistantSurfaceState): void => {
    stateRef.current = next;
    setState(next);
  }, []);

  const setPrompt = useCallback((value: string): void => {
    promptRef.current = value;
    setPromptState(value);
    const current = stateRef.current;
    if (current.kind !== 'closed') draftsRef.current[current.invocation.source] = value;
  }, []);

  const openQuick = useCallback(
    (invocation: AssistantInvocation): void => {
      const current = stateRef.current;
      if (current.kind !== 'closed') {
        draftsRef.current[current.invocation.source] = promptRef.current;
      }
      requestIdentityRef.current += 1;
      if (invocation.anchor instanceof HTMLElement) returnFocusRef.current = invocation.anchor;
      setPrompt(draftsRef.current[invocation.source]);
      setResponse(null);
      setError(null);
      setStatus('idle');
      replaceState({ kind: 'quick', invocation });
    },
    [replaceState, setPrompt],
  );

  const expand = useCallback((): void => {
    const current = stateRef.current;
    if (current.kind === 'quick') {
      replaceState({ kind: 'expanded', invocation: current.invocation });
    }
  }, [replaceState]);

  const close = useCallback((): void => {
    const current = stateRef.current;
    if (current.kind !== 'closed') draftsRef.current[current.invocation.source] = promptRef.current;
    requestIdentityRef.current += 1;
    replaceState({ kind: 'closed' });
    setResponse(null);
    setError(null);
    setStatus('idle');
    queueMicrotask(() => returnFocusRef.current?.focus());
  }, [replaceState]);

  const submit = useCallback(
    async (kind: AiRequestKind, promptOverride?: string): Promise<void> => {
      const current = stateRef.current;
      const submittedPrompt = (promptOverride ?? promptRef.current).trim();
      if (current.kind === 'closed' || status === 'submitting' || submittedPrompt === '') return;
      const invocation = current.invocation;
      const requestId = requestIdentityRef.current + 1;
      requestIdentityRef.current = requestId;
      setStatus('submitting');
      setError(null);
      const command = {
        kind,
        prompt: submittedPrompt,
        source: invocation.source,
        ...(invocation.source === 'practice' ? { activityId: invocation.activityId } : {}),
        ...(invocation.selectedText ? { selectedText: invocation.selectedText } : {}),
      } as const;
      try {
        const result: AiResponse = await api.requestAi(target, command);
        const active = stateRef.current;
        if (
          requestIdentityRef.current !== requestId ||
          active.kind === 'closed' ||
          !sameInvocation(active.invocation, invocation)
        ) {
          return;
        }
        if (result.status === 'disabled') {
          setStatus('disabled');
          setResponse(result.message);
          return;
        }
        const label = contextLabel(invocation);
        const stamp = `${requestId}`;
        setMessages((currentMessages) => [
          ...currentMessages,
          { id: `user-${stamp}`, role: 'user', content: submittedPrompt, source: invocation.source, contextLabel: label },
          { id: `assistant-${stamp}`, role: 'assistant', content: result.content, source: invocation.source, contextLabel: label },
        ]);
        draftsRef.current[invocation.source] = '';
        setPrompt('');
        setResponse(result.content);
        setStatus('idle');
      } catch {
        if (requestIdentityRef.current !== requestId) return;
        setStatus('error');
        setError('Không thể gửi câu hỏi. Hãy thử lại.');
      }
    },
    [api, setPrompt, status, target],
  );

  return { target, state, prompt, messages, response, status, error, openQuick, expand, close, setPrompt, submit };
}
```

- [ ] **Step 5: Run controller tests and typecheck**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/ai-assistant/useContextualAssistant.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/ai-assistant/contextual-assistant-model.ts \
  apps/web/src/features/ai-assistant/useContextualAssistant.ts \
  apps/web/src/features/ai-assistant/useContextualAssistant.test.tsx
git commit -m "feat: add contextual assistant controller"
```

---

### Task 4: Build trigger, context badge, and Quick Ask popover

**Files:**

- Create: `apps/web/src/features/ai-assistant/AssistantTrigger.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantContextBadge.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Produces: `AssistantTrigger({ source, onInvoke })`.
- Produces: `AssistantQuickPopover({ controller })`.
- Uses: fixed-position geometry derived from `HTMLElement.getBoundingClientRect()` or supplied `DOMRect`.

- [ ] **Step 1: Write RED anatomy and interaction tests**

```tsx
it('renders source-specific quick actions and submits without closing', async () => {
  render(<AssistantQuickPopover controller={theoryController()} />);

  expect(screen.getByRole('dialog', { name: 'Trợ lý AI' })).toBeVisible();
  expect(screen.getByText('Lý thuyết · Thuật toán là gì?')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Giải thích' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Cho ví dụ' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Tóm tắt' })).toBeVisible();

  await userEvent.type(screen.getByRole('textbox', { name: 'Câu hỏi' }), 'Vì sao?');
  await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  expect(controller.submit).toHaveBeenCalledWith(
    'explain',
    'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.',
  );
  expect(controller.close).not.toHaveBeenCalled();
});
```

Add a Practice variant asserting `Gợi ý`, `Giải thích lỗi`, and `Kiểm tra cách làm`.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement source-labelled trigger and badge**

`AssistantTrigger` renders the existing `Button` primitive with `Sparkles` and passes the concrete invoking element from the click event:

```tsx
export interface AssistantTriggerProps {
  readonly source: 'theory' | 'practice';
  readonly onInvoke: (anchor: HTMLButtonElement) => void;
}

export function AssistantTrigger({ source, onInvoke }: AssistantTriggerProps): ReactNode {
  return (
    <Button
      size="sm"
      variant="secondary"
      leadingIcon={<Sparkles size={15} />}
      aria-label={source === 'theory' ? 'Hỏi AI về lý thuyết' : 'Hỏi AI về bài tập đang làm'}
      onClick={(event) => onInvoke(event.currentTarget)}
    >
      Hỏi AI
    </Button>
  );
}
```

`AssistantContextBadge` returns the exact label from invocation source, section/activity title, and selection presence.

- [ ] **Step 4: Implement viewport-clamped popover positioning**

Add a pure helper inside `AssistantQuickPopover.tsx`:

```ts
export function assistantPopoverPosition(anchor: DOMRect, viewport: DOMRect): {
  readonly left: number;
  readonly top: number;
} {
  const width = Math.min(420, Math.max(360, viewport.width * 0.28));
  const gap = 8;
  const left = Math.min(
    Math.max(viewport.left + 12, anchor.left),
    viewport.right - width - 12,
  );
  const top = Math.min(anchor.bottom + gap, viewport.bottom - 320);
  return { left, top: Math.max(viewport.top + 12, top) };
}
```

Render the non-modal popover with this anatomy:

```tsx
export function AssistantQuickPopover({
  controller,
}: {
  readonly controller: ContextualAssistantController;
}): ReactNode {
  if (controller.state.kind !== 'quick') return null;
  const invocation = controller.state.invocation;
  const anchorRect =
    invocation.anchor instanceof HTMLElement
      ? invocation.anchor.getBoundingClientRect()
      : invocation.anchor;
  const workspaceRect =
    document.querySelector<HTMLElement>('[data-workspace-main]')?.getBoundingClientRect() ??
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const position = assistantPopoverPosition(anchorRect, workspaceRect);
  const pending = controller.status === 'submitting';
  const actions =
    invocation.source === 'theory'
      ? ([
          ['Giải thích', 'explain', 'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.'],
          ['Cho ví dụ', 'explain', 'Cho một ví dụ cụ thể về nội dung này.'],
          ['Tóm tắt', 'summarize', 'Tóm tắt các ý chính của nội dung này.'],
        ] as const)
      : ([
          ['Gợi ý', 'hint', 'Cho một gợi ý tiếp theo nhưng không đưa đáp án hoàn chỉnh.'],
          ['Giải thích lỗi', 'explain-check-failure', 'Giải thích lỗi trong cách làm hiện tại.'],
          ['Kiểm tra cách làm', 'explain', 'Kiểm tra hướng làm hiện tại và nêu điểm cần xem lại.'],
        ] as const);

  return (
    <section
      className="syn-contextual-assistant-popover"
      data-testid="assistant-quick-popover"
      role="dialog"
      aria-label="Trợ lý AI"
      style={{ left: position.left, top: position.top }}
    >
      <header className="syn-contextual-assistant-popover__header">
        <div>
          <strong>Trợ lý AI</strong>
          <AssistantContextBadge invocation={invocation} />
        </div>
        <button type="button" aria-label="Đóng Trợ lý AI" onClick={controller.close}>×</button>
      </header>
      <div className="syn-contextual-assistant-popover__body">
        {invocation.selectedText ? (
          <blockquote>{invocation.selectedText.slice(0, 240)}</blockquote>
        ) : null}
        <div aria-live="polite" role="status">
          {pending ? 'Đang tạo câu trả lời…' : controller.response}
        </div>
        {controller.error ? <p role="alert">{controller.error}</p> : null}
        <div className="syn-contextual-assistant-popover__actions">
          {actions.map(([label, kind, prompt]) => (
            <button key={label} type="button" disabled={pending} onClick={() => void controller.submit(kind, prompt)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <footer>
        <label htmlFor="assistant-quick-prompt">Câu hỏi</label>
        <textarea
          id="assistant-quick-prompt"
          value={controller.prompt}
          onChange={(event) => controller.setPrompt(event.currentTarget.value)}
        />
        <button type="button" disabled={pending || controller.prompt.trim() === ''} onClick={() => void controller.submit('explain')}>
          Gửi
        </button>
        <button type="button" onClick={controller.expand}>Mở cuộc hội thoại đầy đủ</button>
      </footer>
    </section>
  );
}
```

- [ ] **Step 5: Add authoritative CSS**

Add component-scoped rules:

```css
.syn-contextual-assistant-popover {
  position: fixed;
  z-index: 70;
  display: grid;
  width: clamp(22.5rem, 28vw, 26.25rem);
  max-height: min(60vh, 34rem);
  overflow: hidden;
  border: 1px solid var(--syn-color-border-strong);
  border-radius: 0.875rem;
  background: var(--syn-color-surface);
  box-shadow: 0 18px 48px rgb(15 23 42 / 18%);
}

.syn-contextual-assistant-popover__body {
  min-height: 0;
  overflow: auto;
}
```

Do not change workspace grid rows in this task.

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
pnpm exec eslint \
  apps/web/src/features/ai-assistant/AssistantTrigger.tsx \
  apps/web/src/features/ai-assistant/AssistantContextBadge.tsx \
  apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx
```

Expected: PASS and ESLint exits `0`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/ai-assistant/AssistantTrigger.tsx \
  apps/web/src/features/ai-assistant/AssistantContextBadge.tsx \
  apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx \
  apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx \
  apps/web/src/application.css
git commit -m "feat: add contextual AI quick ask popover"
```

---

### Task 5: Remove the permanent assistant row and mount a zero-footprint overlay layer

**Files:**

- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx`
- Create: `apps/web/src/features/ai-assistant/ContextualAssistantLayer.tsx`
- Create: `apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Removes: `LearningWorkspaceShellProps.assistant`.
- Produces: `LearningWorkspaceShellProps.overlay?: ReactNode` mounted without grid participation.
- Produces: `data-workspace-overlay-root`.

- [ ] **Step 1: Convert shell tests to the zero-footprint contract**

Replace assistant-slot assertions with:

```tsx
it('mounts overlays without reserving a workspace row', () => {
  renderShell({ overlay: <div data-testid="assistant-overlay">Assistant</div> });

  expect(screen.getByTestId('assistant-overlay')).toBeVisible();
  expect(screen.getByTestId('workspace-main')).toBeVisible();
  expect(screen.queryByTestId('workspace-assistant')).not.toBeInTheDocument();
  expect(screen.getByTestId('workspace-layout')).toContainElement(
    screen.getByTestId('assistant-overlay'),
  );
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx
```

Expected: FAIL because the shell still accepts `assistant` and renders a bottom row.

- [ ] **Step 3: Replace assistant composition with an overlay root**

Change props to:

```ts
readonly overlay?: ReactNode;
```

Change `compose` to:

```tsx
const compose = (workspace: ReactNode): ReactNode => (
  <div className="syn-learning-workspace-layout" data-testid="workspace-layout">
    <div
      className="syn-learning-workspace-layout__main"
      data-testid="workspace-main"
      data-workspace-main
    >
      {workspace}
    </div>
    {overlay === undefined ? null : (
      <div className="syn-learning-workspace-layout__overlay" data-workspace-overlay-root>
        {overlay}
      </div>
    )}
  </div>
);
```

The overlay wrapper must use `position: absolute; inset: 0; pointer-events: none;` and each assistant surface restores `pointer-events: auto`.

- [ ] **Step 4: Implement `ContextualAssistantLayer`**

Create the composition-only layer:

```tsx
import type { ReactNode } from 'react';
import { AssistantConversationPanel } from '#src/features/ai-assistant/AssistantConversationPanel';
import { AssistantQuickPopover } from '#src/features/ai-assistant/AssistantQuickPopover';
import type { ContextualAssistantController } from '#src/features/ai-assistant/contextual-assistant-model';
import { useWorkspaceViewport } from '#src/features/learning-workspace/useWorkspaceViewport';

export function ContextualAssistantLayer({
  controller,
}: {
  readonly controller: ContextualAssistantController;
}): ReactNode {
  const viewport = useWorkspaceViewport();
  if (controller.state.kind === 'closed') return null;
  if (controller.state.kind === 'quick') {
    return <AssistantQuickPopover controller={controller} />;
  }
  return (
    <AssistantConversationPanel
      controller={controller}
      mobile={viewport === 'mobile'}
      compact={viewport === 'compact'}
    />
  );
}
```

- [ ] **Step 5: Delete bottom-row CSS owners**

Remove all active `.syn-learning-workspace-layout__assistant` rules and change the layout to a single main row:

```css
.syn-learning-workspace-layout {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

.syn-learning-workspace-layout__overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}
```

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx \
  apps/web/src/application.css
git commit -m "refactor: remove permanent AI workspace row"
```

---

### Task 6: Integrate Theory and Practice persistent triggers

**Files:**

- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`

**Interfaces:**

- Produces: one `useContextualAssistant` instance per lesson or assessment composition.
- Adds: `onAskTheory(anchor, sectionTitle?)` to Theory composition.
- Adds: `onAskPractice(anchor)` to `PracticePane`/header.
- Preserves: Activity Navigator behavior and all workspace controller transitions.

- [ ] **Step 1: Write RED page integration assertions**

In the canonical lesson workspace test, assert:

```tsx
expect(await screen.findByRole('button', { name: 'Hỏi AI về lý thuyết' })).toBeVisible();
expect(screen.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' })).toBeVisible();
expect(screen.queryByTestId('workspace-assistant')).not.toBeInTheDocument();
```

Click the Theory trigger and assert:

```tsx
expect(screen.getByRole('dialog', { name: 'Trợ lý AI' })).toHaveTextContent('Lý thuyết');
```

Click Practice after closing and assert the dialog contains the focused activity title.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
```

Expected: FAIL because both triggers and the contextual layer are absent.

- [ ] **Step 3: Instantiate the controller in both compositions**

Create the target from route/owner data:

```ts
const assistant = useContextualAssistant({
  target: {
    courseId: owner.courseId,
    ownerKind: owner.ownerKind,
    ownerId: owner.ownerId,
    ...(chapterId ? { chapterId } : {}),
  },
});
```

Add `chapterId?: string` to `LessonWorkspaceComposition` and pass the route chapter ID. Assessment composition already owns `chapterId`.

- [ ] **Step 4: Add the Theory trigger without coupling lesson content to the API**

Render a compact toolbar inside the Theory article before `LessonActivities`:

```tsx
<div className="syn-theory-assistant-entry">
  <AssistantTrigger
    source="theory"
    onInvoke={(anchor) =>
      assistant.openQuick({
        source: 'theory',
        sectionTitle: lesson.title,
        anchor,
      })
    }
  />
</div>
```

Assessment uses `assessment.title`.

- [ ] **Step 5: Add the Practice header trigger**

Extend `PracticePaneHeader` props with:

```ts
readonly onAskAI: (anchor: HTMLButtonElement) => void;
```

Render `AssistantTrigger source="practice"` before Navigator controls. `PracticePane` supplies:

```tsx
onAskAI={(anchor) =>
  onAskPractice({
    source: 'practice',
    activityId: focusedActivity.activity.id,
    activityTitle: focusedActivity.activity.title,
    anchor,
  })
}
```

`PracticePane` receives `onAskPractice(invocation: AssistantInvocation): void` from the composition.

- [ ] **Step 6: Mount the contextual layer**

Pass:

```tsx
overlay={<ContextualAssistantLayer controller={assistant} />}
```

Remove all `AssistantPanel` imports and `assistant={...}` props.

- [ ] **Step 7: Run focused verification**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/features/lesson-content/LessonActivities.tsx \
  apps/web/src/features/learning-workspace/PracticePane.tsx \
  apps/web/src/features/learning-workspace/PracticePaneHeader.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
git commit -m "feat: add theory and practice AI entry points"
```

---

### Task 7: Add bounded Theory selection context

**Files:**

- Create: `apps/web/src/features/ai-assistant/useTheoryAssistantSelection.ts`
- Create: `apps/web/src/features/ai-assistant/useTheoryAssistantSelection.test.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantSelectionToolbar.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantSelectionToolbar.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Produces: `TheoryAssistantSelection { text, rect } | null`.
- Produces: `useTheoryAssistantSelection(containerRef)`.
- Produces: keyboard-accessible selection action equivalent to the floating toolbar.

- [ ] **Step 1: Write RED selection tests**

Test normalization and containment by stubbing `window.getSelection()`:

```tsx
it('accepts only a bounded selection fully inside the Theory zone', () => {
  const { result } = renderHook(() => useTheoryAssistantSelection(theoryRef));
  dispatchSelection(theoryTextNode, '  thuật toán\r\n  hữu hạn  ');

  expect(result.current.selection).toEqual({
    text: 'thuật toán\nhữu hạn',
    rect: expect.any(DOMRect),
  });

  dispatchSelection(outsideNode, 'outside');
  expect(result.current.selection).toBeNull();
});
```

Also assert whitespace-only and 2,001-code-point selections are ignored; Escape clears the toolbar.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant/useTheoryAssistantSelection.test.tsx \
  apps/web/src/features/ai-assistant/AssistantSelectionToolbar.test.tsx
```

Expected: FAIL because the hook and toolbar do not exist.

- [ ] **Step 3: Implement selection containment and Unicode normalization**

Create `useTheoryAssistantSelection.ts`:

```ts
import { useEffect, useState, type RefObject } from 'react';

export interface TheoryAssistantSelection {
  readonly text: string;
  readonly rect: DOMRect;
}

export function normalizeTheorySelection(value: string): string | null {
  const text = value
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
  if (text === '' || [...text].length > 2000) return null;
  return text;
}

export function useTheoryAssistantSelection(
  containerRef: RefObject<HTMLElement | null>,
): {
  readonly selection: TheoryAssistantSelection | null;
  readonly clearToolbar: () => void;
} {
  const [selection, setSelection] = useState<TheoryAssistantSelection | null>(null);
  useEffect(() => {
    const update = (): void => {
      const container = containerRef.current;
      const browserSelection = window.getSelection();
      if (!container || !browserSelection || browserSelection.rangeCount !== 1 || browserSelection.isCollapsed) {
        setSelection(null);
        return;
      }
      const range = browserSelection.getRangeAt(0);
      if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
        setSelection(null);
        return;
      }
      const text = normalizeTheorySelection(browserSelection.toString());
      if (!text) {
        setSelection(null);
        return;
      }
      setSelection({ text, rect: range.getBoundingClientRect() });
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelection(null);
    };
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (containerRef.current?.contains(target)) return;
      if (target.closest('[data-assistant-selection-toolbar]')) return;
      setSelection(null);
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [containerRef]);
  return { selection, clearToolbar: () => setSelection(null) };
}
```

- [ ] **Step 4: Implement the anchored toolbar**

Create `AssistantSelectionToolbar.tsx`:

```tsx
export function AssistantSelectionToolbar({
  selection,
  onAsk,
}: {
  readonly selection: TheoryAssistantSelection;
  readonly onAsk: (anchor: DOMRect) => void;
}): ReactNode {
  const left = Math.max(12, Math.min(selection.rect.left, window.innerWidth - 220));
  const top = Math.max(12, selection.rect.top - 44);
  return (
    <div
      data-assistant-selection-toolbar
      data-testid="assistant-selection-toolbar"
      className="syn-assistant-selection-toolbar"
      style={{ left, top }}
      onPointerDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        aria-label="Hỏi AI về đoạn lý thuyết đã chọn"
        onClick={() => onAsk(selection.rect)}
      >
        Hỏi AI
      </button>
    </div>
  );
}
```

Beside the persistent Theory trigger, render a second keyboard-reachable button with the same label whenever `selection !== null`; both actions call the same `onAsk` callback.

- [ ] **Step 5: Wire selection invocation**

On toolbar action:

```ts
assistant.openQuick({
  source: 'theory',
  sectionTitle: lesson.title,
  selectedText: selection.text,
  anchor: selection.rect,
});
selection.clearToolbar();
```

Do not call `window.getSelection()?.removeAllRanges()` until after Quick Ask has opened.

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant/useTheoryAssistantSelection.test.tsx \
  apps/web/src/features/ai-assistant/AssistantSelectionToolbar.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
pnpm exec eslint apps/web/src/features/ai-assistant/useTheoryAssistantSelection.ts \
  apps/web/src/features/ai-assistant/AssistantSelectionToolbar.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/ai-assistant/useTheoryAssistantSelection.ts \
  apps/web/src/features/ai-assistant/useTheoryAssistantSelection.test.tsx \
  apps/web/src/features/ai-assistant/AssistantSelectionToolbar.tsx \
  apps/web/src/features/ai-assistant/AssistantSelectionToolbar.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx \
  apps/web/src/application.css
git commit -m "feat: add theory selection AI context"
```

---

### Task 8: Add explicit Practice item context without mutating answers

**Files:**

- Modify: `apps/web/src/features/activity-engine/types.ts`
- Modify: `apps/web/src/features/activity-engine/ActivityHost.tsx`
- Modify: `apps/web/src/features/activity-engine/ActivityHost.test.tsx`
- Modify: `apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx`
- Modify: `apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.tsx`

**Interfaces:**

- Produces: `ActivityAssistantTarget { label: string; selectedText?: string }`.
- Adds: `onAskAIAboutItem?: (target, anchor) => void` to renderer/host props.
- First supported renderer: Ordering.

- [ ] **Step 1: Write RED non-mutation test**

Add to `OrderingActivity.test.tsx`:

```tsx
it('asks AI about an item without reordering or changing the answer', async () => {
  const onChange = vi.fn();
  const onAskAIAboutItem = vi.fn();
  renderOrdering({ onChange, onAskAIAboutItem });

  await userEvent.click(screen.getByRole('button', { name: 'Hỏi AI về bước Hiển thị kết quả' }));

  expect(onAskAIAboutItem).toHaveBeenCalledWith(
    { label: 'Hiển thị kết quả', selectedText: 'Hiển thị kết quả' },
    expect.any(HTMLButtonElement),
  );
  expect(onChange).not.toHaveBeenCalled();
});
```

Assert the AI action is not inside `[data-ordering-drag-handle]` and remains disabled only when the entire activity is disabled.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx \
  apps/web/src/features/activity-engine/ActivityHost.test.tsx
```

Expected: FAIL because the callback and action do not exist.

- [ ] **Step 3: Add the narrow renderer callback contract**

In `types.ts`:

```ts
export interface ActivityAssistantTarget {
  readonly label: string;
  readonly selectedText?: string;
}

readonly onAskAIAboutItem?: (
  target: ActivityAssistantTarget,
  anchor: HTMLButtonElement,
) => void;
```

Add it to both `ActivityHostProps` and `ActivityRendererProps`, then pass through `ActivityHost` without importing assistant controller types.

- [ ] **Step 4: Add Ordering item actions**

Inside each ordering row, add a separate compact button:

```tsx
<button
  type="button"
  className="syn-activity-ordering__ask-ai"
  disabled={disabled}
  aria-label={`Hỏi AI về bước ${label}`}
  onClick={(event) =>
    onAskAIAboutItem?.(
      { label, selectedText: label },
      event.currentTarget,
    )
  }
>
  <Sparkles aria-hidden="true" size={15} />
</button>
```

Do not attach this handler to the row, drag affordance, or move buttons.

- [ ] **Step 5: Convert the callback to a Practice invocation**

`PracticePane` supplies:

```ts
onAskAIAboutItem={(target, anchor) =>
  onAskPractice({
    source: 'practice',
    activityId: focusedActivity.activity.id,
    activityTitle: focusedActivity.activity.title,
    selectedText: target.selectedText ?? target.label,
    anchor,
  })
}
```

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx \
  apps/web/src/features/activity-engine/ActivityHost.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: PASS and existing ordering movement tests remain green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/activity-engine/types.ts \
  apps/web/src/features/activity-engine/ActivityHost.tsx \
  apps/web/src/features/activity-engine/ActivityHost.test.tsx \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.tsx
git commit -m "feat: add practice item AI context actions"
```

---

### Task 9: Add expanded conversation panel and responsive surfaces

**Files:**

- Create: `apps/web/src/features/ai-assistant/AssistantConversationPanel.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx`
- Modify: `apps/web/src/features/ai-assistant/ContextualAssistantLayer.tsx`
- Modify: `apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Produces: desktop non-modal overlay panel.
- Produces: compact near-full-width side sheet.
- Produces: mobile full-screen `Dialog`.
- Preserves: invocation, prompt, response, messages, and Activity Navigator state across expand/collapse.

- [ ] **Step 1: Write RED continuity and focus tests**

```tsx
it('expands without changing invocation or losing the prompt', async () => {
  vi.stubGlobal('matchMedia', wideThreeMatchMedia);
  render(<ContextualAssistantLayer controller={controllerWithQuickPractice()} />);
  await userEvent.type(screen.getByRole('textbox', { name: 'Câu hỏi' }), 'Giải thích bước này');
  await userEvent.click(screen.getByRole('button', { name: 'Mở cuộc hội thoại đầy đủ' }));

  expect(screen.getByRole('complementary', { name: 'Trợ lý AI' })).toHaveTextContent(
    'Bài tập · Sắp xếp thuật toán',
  );
  expect(screen.getByRole('textbox', { name: 'Tiếp tục cuộc hội thoại' })).toHaveValue(
    'Giải thích bước này',
  );
  expect(controller.state.kind).toBe('expanded');
});
```

Add a mobile test expecting `role="dialog"`, `aria-modal="true"`, and focus containment through the existing `Dialog` primitive.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx
```

Expected: FAIL because the expanded panel does not exist.

- [ ] **Step 3: Implement desktop and compact panel anatomy**

Desktop panel:

```css
.syn-contextual-assistant-panel {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  z-index: 80;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: clamp(26.25rem, 36vw, 35rem);
  border-inline-start: 1px solid var(--syn-color-border-strong);
  background: var(--syn-color-surface);
  box-shadow: -18px 0 48px rgb(15 23 42 / 16%);
  pointer-events: auto;
}
```

Implement the shared panel body and desktop surface:

```tsx
function ConversationBody({ controller }: { readonly controller: ContextualAssistantController }): ReactNode {
  return (
    <>
      <header className="syn-contextual-assistant-panel__header">
        <div>
          <strong>Trợ lý AI</strong>
          {controller.state.kind === 'expanded' ? (
            <AssistantContextBadge invocation={controller.state.invocation} />
          ) : null}
        </div>
        <button type="button" aria-label="Đóng Trợ lý AI" onClick={controller.close}>×</button>
      </header>
      <div className="syn-contextual-assistant-panel__messages" aria-label="Cuộc hội thoại">
        {controller.messages.map((message) => (
          <article key={message.id} data-role={message.role}>
            <span>{message.contextLabel}</span>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      <footer className="syn-contextual-assistant-panel__composer">
        <label htmlFor="assistant-conversation-prompt">Tiếp tục cuộc hội thoại</label>
        <textarea
          id="assistant-conversation-prompt"
          value={controller.prompt}
          onChange={(event) => controller.setPrompt(event.currentTarget.value)}
        />
        <button type="button" disabled={controller.status === 'submitting'} onClick={() => void controller.submit('explain')}>
          Gửi
        </button>
      </footer>
    </>
  );
}

export function AssistantConversationPanel({
  controller,
  mobile,
  compact,
}: {
  readonly controller: ContextualAssistantController;
  readonly mobile: boolean;
  readonly compact: boolean;
}): ReactNode {
  if (controller.state.kind !== 'expanded') return null;
  if (mobile) {
    return (
      <Dialog
        title="Trợ lý AI"
        open
        onOpenChange={(open) => { if (!open) controller.close(); }}
        contentClassName="syn-contextual-assistant-panel--mobile"
      >
        <ConversationBody controller={controller} />
      </Dialog>
    );
  }
  return (
    <aside
      className={compact ? 'syn-contextual-assistant-panel syn-contextual-assistant-panel--compact' : 'syn-contextual-assistant-panel'}
      data-testid="assistant-expanded-panel"
      role="complementary"
      aria-label="Trợ lý AI"
    >
      <ConversationBody controller={controller} />
    </aside>
  );
}
```

- [ ] **Step 4: Verify mobile full-screen dialog behavior**

Use the existing `Dialog` primitive shown above. The test must close it through `onOpenChange(false)` and assert `controller.close()` exactly once.

- [ ] **Step 5: Preserve Navigator and workspace dimensions**

Do not pass any assistant state to `WorkspaceShell`; only render inside `data-workspace-overlay-root`. Add tests that the permanent Navigator remains mounted before, during, and after expanded mode.

- [ ] **Step 6: Add reduced-motion and responsive CSS**

```css
@media (prefers-reduced-motion: reduce) {
  .syn-contextual-assistant-popover,
  .syn-contextual-assistant-panel {
    transition: none;
  }
}

@media (max-width: 719px) {
  .syn-contextual-assistant-popover {
    inset: auto 0 0;
    width: 100%;
    max-height: 70vh;
    border-radius: 1rem 1rem 0 0;
  }
}
```

- [ ] **Step 7: Run focused verification**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/ai-assistant/AssistantConversationPanel.tsx \
  apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx \
  apps/web/src/application.css
git commit -m "feat: add expandable AI conversation panel"
```

---

### Task 10: Complete localized lifecycle, disabled, error, and accessibility states

**Files:**

- Modify: `apps/web/src/features/ai-assistant/useContextualAssistant.ts`
- Modify: `apps/web/src/features/ai-assistant/useContextualAssistant.test.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantConversationPanel.tsx`
- Modify: `apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx`

**Interfaces:**

- Produces localized copy for disabled, validation, network, and provider errors.
- Preserves prompts after recoverable errors.
- Disables repeated submits while pending.
- `Escape` closes the topmost surface and restores focus.

- [ ] **Step 1: Add RED lifecycle tests**

Assert these exact outcomes:

```tsx
expect(screen.getByRole('status')).toHaveTextContent('Trợ lý AI chưa được cấu hình.');
expect(screen.getByRole('alert')).toHaveTextContent('Không thể gửi câu hỏi. Hãy thử lại.');
expect(screen.getByRole('textbox', { name: 'Câu hỏi' })).toHaveValue('Câu hỏi chưa gửi được');
expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
```

Add an Escape test that closes expanded first, then Quick Ask, and returns focus to the original trigger.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant/useContextualAssistant.test.tsx \
  apps/web/src/features/ai-assistant/ContextualAssistantLayer.test.tsx
```

Expected: FAIL on copy, prompt retention, or focus behavior.

- [ ] **Step 3: Normalize lifecycle states**

Map API outcomes to:

```ts
const localizedAssistantError = (error: unknown): string =>
  error instanceof SynaploomApiError && error.code === 'AI_CONTEXT_INVALID'
    ? 'Ngữ cảnh câu hỏi không hợp lệ. Hãy chọn lại nội dung.'
    : 'Không thể gửi câu hỏi. Hãy thử lại.';
```

On disabled response, set `status: 'disabled'`, preserve prompt, and render `Trợ lý AI chưa được cấu hình.`. On recoverable error, preserve prompt. On success, append both user and assistant messages with context labels and clear only the submitted source draft.

- [ ] **Step 4: Implement topmost Escape handling**

Add this effect to `ContextualAssistantLayer` before the closed-state return:

```ts
useEffect(() => {
  if (controller.state.kind === 'closed') return undefined;
  const closeOnEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    controller.close();
  };
  document.addEventListener('keydown', closeOnEscape);
  return () => document.removeEventListener('keydown', closeOnEscape);
}, [controller]);
```

Expanded and Quick Ask are mutually exclusive states, so one handler always closes the topmost assistant surface. Focus restoration remains in the controller microtask.

- [ ] **Step 5: Verify live-region behavior**

Use one concise `aria-live="polite"` region for pending/disabled/success announcements and `role="alert"` only for actionable errors. Do not mark the complete message list live.

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/ai-assistant
pnpm exec eslint apps/web/src/features/ai-assistant
pnpm --filter @synaploom/web typecheck
```

Expected: all AI assistant tests PASS, ESLint and typecheck exit `0`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/ai-assistant
git commit -m "fix: harden contextual AI lifecycle and accessibility"
```

---

### Task 11: Retire the obsolete dock implementation and update all test doubles

**Files:**

- Delete: `apps/web/src/features/ai-assistant/AssistantPanel.tsx`
- Delete: `apps/web/src/features/ai-assistant/AssistantPanel.test.tsx`
- Delete: `packages/ui/src/components/assistant-dock/assistant-dock.tsx`
- Delete: `packages/ui/src/components/assistant-dock/assistant-dock.test.tsx`
- Modify: `packages/ui/src/index.ts`
- Create: `packages/ui/src/index.test.ts`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/application.css`
- Modify: all web test fake clients containing `requestAi`.

**Interfaces:**

- Removes: `AssistantDock`, `AssistantDockProps`, `AssistantMode`, `AssistantPanel`, `data-assistant-dock-surface`.
- Preserves: `SynaploomApiClient.requestAi(target, command)` in every fake.

- [ ] **Step 1: Add RED absence assertions**

In `LearningWorkspacePage.test.tsx`:

```tsx
expect(document.querySelector('[data-assistant-dock-surface]')).not.toBeInTheDocument();
expect(document.querySelector('.syn-assistant-dock')).not.toBeInTheDocument();
```

Create `packages/ui/src/index.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('does not export the retired AssistantDock', () => {
  const source = readFileSync('packages/ui/src/index.ts', 'utf8');
  expect(source).not.toContain('AssistantDock');
  expect(source).not.toContain('assistant-dock');
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  packages/ui/src/index.test.ts
```

Expected: FAIL while the dock export and implementation remain.

- [ ] **Step 3: Remove obsolete source, exports, and styles**

Delete the four dock/panel files. Remove the `AssistantDock` export block from `packages/ui/src/index.ts`. Delete `.syn-assistant-dock*`, `.syn-assistant-context`, and superseded dock placement rules only after `rg` proves no remaining consumer.

- [ ] **Step 4: Update fake API clients mechanically**

Every fake must use:

```ts
requestAi: (_target, _command) =>
  Promise.resolve({ status: 'disabled' as const, message: 'Trợ lý AI chưa được cấu hình.' }),
```

Use explicit parameters rather than `as unknown as` where the complete fake is already typed.

- [ ] **Step 5: Run scoped repository verification**

Run:

```bash
rg -n "AssistantDock|AssistantPanel|assistant-dock|workspace-assistant|data-assistant-dock-surface" \
  apps packages tests
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant \
  apps/web/src/features/workspace-layout \
  apps/web/src/features/learning-workspace \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx
pnpm --filter @synaploom/ui typecheck
pnpm --filter @synaploom/web typecheck
```

Expected: `rg` returns no production references to retired dock identifiers; tests and typechecks PASS.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/features/ai-assistant \
  packages/ui/src/components/assistant-dock \
  packages/ui/src/index.ts \
  packages/ui/src/index.test.ts \
  packages/ui/src/styles.css \
  apps/web/src/application.css \
  apps/web/src
git commit -m "refactor: retire permanent assistant dock"
```

---

### Task 12: Add browser geometry, no-reflow, selection, focus, and mobile contracts

**Files:**

- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts`
- Add snapshots under: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/`
- Modify: `docs/superpowers/specs/2026-07-21-contextual-ai-assistant-design.md` only to record final verified selectors if implementation names differ.

**Interfaces:**

- Produces stable test IDs: `assistant-quick-popover`, `assistant-expanded-panel`, `assistant-selection-toolbar`.
- Preserves canonical Theory/Practice/Navigator geometry while AI is closed or expanded.

- [ ] **Step 1: Replace permanent-dock geometry assertions with zero-footprint assertions**

At canonical `1672 × 941`:

```ts
await expect(page.getByTestId('workspace-assistant')).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Hỏi AI về lý thuyết' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' })).toBeVisible();

const before = await workspaceGeometry(page);
await page.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' }).click();
await expect(page.getByTestId('assistant-quick-popover')).toBeVisible();
const afterQuick = await workspaceGeometry(page);
expect(afterQuick).toEqual(before);
```

- [ ] **Step 2: Add expanded no-reflow and Navigator persistence assertions**

```ts
await page.getByRole('button', { name: 'Mở cuộc hội thoại đầy đủ' }).click();
await expect(page.getByTestId('assistant-expanded-panel')).toBeVisible();
expect(await workspaceGeometry(page)).toEqual(before);
await expect(page.getByRole('navigation', { name: /Thực hành/ })).toBeAttached();
await page.keyboard.press('Escape');
await expect(page.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' })).toBeFocused();
```

- [ ] **Step 3: Add Theory selection behavior**

Use `page.locator('[data-theory-reading-column] p').first().selectText()`, assert the selection toolbar appears, click `Hỏi AI về đoạn lý thuyết đã chọn`, and assert Quick Ask shows `Đoạn được chọn`. Select text outside Theory and assert no toolbar.

- [ ] **Step 4: Add Practice item non-mutation assertion**

Capture ordering row labels before clicking `Hỏi AI về bước Hiển thị kết quả`; assert labels are identical afterward and the popover context names that item.

- [ ] **Step 5: Add mobile contracts**

At `390 × 844`, assert Quick Ask is bottom-aligned, expanded conversation is `role="dialog"` with full viewport bounds, Escape/close returns focus to the Practice-dialog trigger, and Activity answer state remains unchanged.

- [ ] **Step 6: Run browser verification only when the execution environment permits it**

Run:

```bash
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: all contextual assistant behavior tests PASS. Do not update snapshots while a behavior or geometry assertion is failing.

- [ ] **Step 7: Capture approved regression snapshots**

Capture exactly:

- AI closed at canonical desktop;
- Theory Quick Ask;
- Practice Quick Ask;
- Theory selection toolbar;
- expanded desktop conversation;
- mobile Quick Ask;
- mobile expanded conversation.

Run the same test without `--update-snapshots` immediately afterward and require PASS.

- [ ] **Step 8: Run final lightweight and full verification**

Lightweight commands:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/ai-assistant \
  apps/web/src/features/workspace-layout \
  apps/web/src/features/learning-workspace \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx
bash scripts/go/with-internal-toolchain.sh test ./internal/server ./internal/ai -run 'AI' -count=1
pnpm --filter @synaploom/ui typecheck
pnpm --filter @synaploom/web typecheck
pnpm exec eslint apps/web/src/features/ai-assistant \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx \
  apps/web/src/features/learning-workspace \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx
git diff --check
```

Full commands before merge or release:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm go:test
pnpm test:e2e --project=go-runtime
```

Expected: all commands exit `0`; browser geometry proves the workspace does not reflow.

- [ ] **Step 9: Commit**

```bash
git add tests/e2e/single-active-workspace-go-runtime.spec.ts \
  tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots \
  docs/superpowers/specs/2026-07-21-contextual-ai-assistant-design.md
git commit -m "test: verify contextual AI workspace behavior"
```

---

## Final acceptance checklist

- [ ] No permanent assistant row, column, launcher, or Navigator tab exists.
- [ ] Theory and Practice both expose visible source-specific `Hỏi AI` triggers.
- [ ] Theory selection is contained, normalized, bounded to 2,000 Unicode code points, and keyboard-accessible.
- [ ] Ordering item AI actions do not call `onChange`, reorder rows, save, submit, or check.
- [ ] Quick Ask remains inside viewport bounds and does not resize the workspace.
- [ ] Expanded desktop conversation overlays without resizing Theory, Practice, or Navigator.
- [ ] Mobile Quick Ask and expanded conversation use the specified sheet/dialog behavior.
- [ ] Every message visibly records its Theory/Practice/selection/item context.
- [ ] The daemon validates owner and activity relationships and builds trusted context.
- [ ] Disabled/error states preserve prompts and never block learning actions.
- [ ] Closing restores focus to the correct trigger and Escape closes the topmost assistant surface.
- [ ] Reduced-motion behavior is covered.
- [ ] Obsolete AssistantDock code, exports, styles, selectors, and snapshots are removed.
