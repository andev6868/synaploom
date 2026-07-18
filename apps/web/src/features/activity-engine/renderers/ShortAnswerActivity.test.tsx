import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';
import { ShortAnswerActivity } from '#src/features/activity-engine/renderers/ShortAnswerActivity';

const activity: ActivityPublicView = {
  id: 'short',
  kind: 'short-answer',
  title: 'Short answer',
  prompt: { blocks: [] },
  config: { maximumLength: 40 },
  evaluation: { mode: 'automatic', points: 1 },
  completion: { required: true },
};

it('keeps the learner text in a labeled input', () => {
  render(<RendererHarness Renderer={ShortAnswerActivity} activity={activity} />);
  const input = screen.getByRole('textbox', { name: 'Câu trả lời' });
  fireEvent.change(input, { target: { value: '  Hà Nội  ' } });
  expect(input).toHaveValue('  Hà Nội  ');
  expect(input).toHaveAttribute('maxlength', '40');
});
