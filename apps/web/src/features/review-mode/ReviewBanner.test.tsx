import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewBanner } from './ReviewBanner';

describe('ReviewBanner', () => {
  it('shows review context and return action', () => {
    render(<ReviewBanner currentTitle="Rendering Pipeline" onReturn={vi.fn()} />);
    expect(screen.getByText(/Đang xem lại/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Quay lại bài đang học: Rendering Pipeline/ })).toBeVisible();
  });
});
