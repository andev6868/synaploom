import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';
import { WritingActivity } from '#src/features/activity-engine/renderers/WritingActivity';

const activity: ActivityPublicView = {
  id: 'writing',
  kind: 'writing',
  title: 'Essay',
  prompt: { blocks: [] },
  config: {
    minimumCharacters: 10,
    maximumCharacters: 100,
    answerFormat: 'plain-text',
    outlinePrompts: ['Nêu luận điểm chính'],
  },
  evaluation: { mode: 'submission', points: 0 },
  completion: { required: true },
};

it('shows outline prompts and announces the live character count', () => {
  render(<RendererHarness Renderer={WritingActivity} activity={activity} />);
  expect(screen.getByText('Nêu luận điểm chính')).toBeVisible();
  const textarea = screen.getByRole('textbox', { name: 'Bài viết' });
  fireEvent.change(textarea, { target: { value: 'Một luận điểm' } });
  expect(textarea).toHaveValue('Một luận điểm');
  expect(screen.getByRole('status')).toHaveTextContent('13/100 ký tự');
});
