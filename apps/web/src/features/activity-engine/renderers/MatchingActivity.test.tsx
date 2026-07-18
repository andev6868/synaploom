import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MatchingActivity } from '#src/features/activity-engine/renderers/MatchingActivity';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';

const activity: ActivityPublicView = {
  id: 'match',
  kind: 'matching',
  title: 'Match',
  prompt: { blocks: [] },
  config: {
    left: [{ id: 'one', label: 'One' }],
    right: [
      { id: 'uno', label: 'Uno' },
      { id: 'dos', label: 'Dos' },
    ],
  },
  evaluation: { mode: 'automatic', points: 1 },
  completion: { required: true },
};

it('provides a select-based matching workflow', () => {
  render(<RendererHarness Renderer={MatchingActivity} activity={activity} />);
  const select = screen.getByRole('combobox', { name: 'Ghép với One' });
  fireEvent.change(select, { target: { value: 'uno' } });
  expect(select).toHaveValue('uno');
});
