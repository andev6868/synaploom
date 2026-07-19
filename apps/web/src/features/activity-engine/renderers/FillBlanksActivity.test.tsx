import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FillBlanksActivity } from '#src/features/activity-engine/renderers/FillBlanksActivity';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';

const activity: ActivityPublicView = {
  id: 'blanks',
  kind: 'fill-blanks',
  title: 'Fill blanks',
  prompt: { blocks: [] },
  config: {
    blanks: [
      { id: 'subject', label: 'Chủ ngữ' },
      { id: 'verb', label: 'Động từ' },
    ],
    scoring: 'per-blank',
  },
  evaluation: { mode: 'automatic', points: 2 },
  completion: { required: true },
  presentation: {
    defaultSurface: 'inline',
    allowInline: true,
    allowPractice: true,
    preferredWidth: 'compact',
    supportsFullscreen: false,
  },
};

it('renders one labeled field per blank and retains each value', () => {
  render(<RendererHarness Renderer={FillBlanksActivity} activity={activity} />);
  const subject = screen.getByRole('textbox', { name: 'Chủ ngữ' });
  const verb = screen.getByRole('textbox', { name: 'Động từ' });
  fireEvent.change(subject, { target: { value: 'She' } });
  fireEvent.change(verb, { target: { value: 'runs' } });
  expect(subject).toHaveValue('She');
  expect(verb).toHaveValue('runs');
  expect(subject).toHaveAccessibleDescription('Điền câu trả lời cho ô Chủ ngữ.');
});
