import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';
import { TrueFalseActivity } from '#src/features/activity-engine/renderers/TrueFalseActivity';

const activity: ActivityPublicView = {
  id: 'truth',
  kind: 'true-false',
  title: 'Statement',
  prompt: { blocks: [] },
  config: {},
  evaluation: { mode: 'automatic', points: 1 },
  completion: { required: true },
  presentation: {
    defaultSurface: 'inline',
    allowInline: true,
    allowPractice: true,
    preferredWidth: 'compact',
    supportsFullscreen: false,
  },
};

it('uses explicit true and false labels', () => {
  render(<RendererHarness Renderer={TrueFalseActivity} activity={activity} />);
  const truth = screen.getByRole('radio', { name: 'Đúng' });
  const falsehood = screen.getByRole('radio', { name: 'Sai' });
  fireEvent.click(falsehood);
  expect(falsehood).toBeChecked();
  expect(truth).not.toBeChecked();
});
