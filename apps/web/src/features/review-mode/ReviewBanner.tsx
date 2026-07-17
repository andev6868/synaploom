import type { ReactNode } from 'react';

export function ReviewBanner({ currentTitle, onReturn }: { readonly currentTitle: string; readonly onReturn: () => void }): ReactNode {
  return (
    <aside className="syn-review-banner" aria-label="Chế độ xem lại">
      <strong>✓ Bài học đã hoàn thành · Đang xem lại</strong>
      <button type="button" onClick={onReturn}>Quay lại bài đang học: {currentTitle}</button>
    </aside>
  );
}
