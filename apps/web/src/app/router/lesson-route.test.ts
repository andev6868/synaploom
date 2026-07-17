import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigateToAssessment, navigateToLesson, parseLearningRoute } from './lesson-route';

describe('parseLearningRoute', () => {
  it('parses canonical lesson routes', () => {
    expect(parseLearningRoute('/courses/perf/chapters/runtime/lessons/event-loop')).toEqual({
      kind: 'lesson',
      courseId: 'perf',
      chapterId: 'runtime',
      lessonId: 'event-loop',
    });
  });

  it('parses canonical assessment routes', () => {
    expect(parseLearningRoute('/courses/perf/chapters/runtime/assessments/capstone')).toEqual({
      kind: 'assessment',
      courseId: 'perf',
      chapterId: 'runtime',
      assessmentId: 'capstone',
    });
  });

  it('keeps short lesson routes as compatibility routes', () => {
    expect(parseLearningRoute('/courses/perf/lessons/event-loop')).toEqual({
      kind: 'legacy-lesson',
      courseId: 'perf',
      lessonId: 'event-loop',
    });
  });
});

describe('canonical navigation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes encoded lesson and assessment URLs', () => {
    const pushState = vi.fn();
    vi.stubGlobal('history', { pushState, replaceState: vi.fn() });
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal(
      'PopStateEvent',
      class {
        readonly type: string;
        constructor(type: string) {
          this.type = type;
        }
      },
    );

    navigateToLesson('perf course', 'runtime', 'event loop');
    navigateToAssessment('perf course', 'runtime', 'capstone');

    expect(pushState).toHaveBeenNthCalledWith(
      1,
      {},
      '',
      '/courses/perf%20course/chapters/runtime/lessons/event%20loop',
    );
    expect(pushState).toHaveBeenNthCalledWith(
      2,
      {},
      '',
      '/courses/perf%20course/chapters/runtime/assessments/capstone',
    );
  });
});
