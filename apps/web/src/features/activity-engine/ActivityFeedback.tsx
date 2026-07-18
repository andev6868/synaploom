import type { ActivityFeedback as ActivityFeedbackPayload } from '@synaploom/contracts';
import { useEffect, useRef, type ReactNode } from 'react';

export function ActivityFeedback({ feedback }: { readonly feedback: ActivityFeedbackPayload }): ReactNode {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [feedback]);
  return (
    <section className="syn-activity-feedback" aria-live="polite">
      <h3 ref={heading} tabIndex={-1}>Kết quả</h3>
      <p>{feedback.summary}</p>
      {feedback.details.length > 0 ? (
        <ul>
          {feedback.details.map((detail, index) => (
            <li key={`${detail.code}-${detail.field ?? 'activity'}-${index}`}>{detail.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
