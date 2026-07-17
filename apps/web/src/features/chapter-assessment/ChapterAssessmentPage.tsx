import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { SynLessonProgress } from '#src/features/learning-progress/SynLessonProgress';
import { navigateToAssessment, navigateToLesson } from '#src/app/router/lesson-route';

export function ChapterAssessmentPage({ courseId, chapterId, assessmentId }: { readonly courseId: string; readonly chapterId: string; readonly assessmentId: string }): ReactNode {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigation = useQuery({ queryKey: ['course-navigation', courseId], queryFn: () => api.getNavigation(courseId) });
  const assessment = useQuery({ queryKey: ['chapter-assessment', courseId, chapterId, assessmentId], queryFn: () => api.getChapterAssessment(chapterId, assessmentId) });
  const check = useMutation({
    mutationFn: () => api.recordChapterAssessment(chapterId, assessmentId, { passed: true, summary: 'Completed from assessment workspace.' }),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['course-navigation', courseId] }), queryClient.invalidateQueries({ queryKey: ['chapter-assessment', courseId, chapterId, assessmentId] })]); },
  });
  if (navigation.isLoading || assessment.isLoading) return <main className="syn-loading">Đang tải thực hành chương…</main>;
  if (!navigation.data || !assessment.data) return <main className="syn-error">Không thể mở thực hành chương.</main>;
  return <main className="syn-assessment-page">
    <SynLessonProgress navigation={navigation.data} viewedItemId={assessmentId} onOpenLesson={(targetChapter, lessonId) => navigateToLesson(courseId, targetChapter, lessonId)} onOpenAssessment={(targetChapter, targetAssessment) => navigateToAssessment(courseId, targetChapter, targetAssessment)} onLockedItem={() => undefined} />
    <article>
      <p>Thực hành chương</p><h1>{assessment.data.title}</h1>
      <ul>{assessment.data.requirements.map((item) => <li key={`${item.kind}:${item.id}`}>{item.satisfied ? '✓' : '○'} {item.id} {item.required ? '· Bắt buộc' : '· Tùy chọn'}</li>)}</ul>
      <button type="button" disabled={check.isPending || assessment.data.status === 'LOCKED'} onClick={() => check.mutate()}>{assessment.data.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Kiểm tra kết quả'}</button>
    </article>
  </main>;
}
