import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { OrderingActivity } from '#src/features/activity-engine/renderers/OrderingActivity';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';

const activity: ActivityPublicView = {
  id: 'order',
  kind: 'ordering',
  title: 'Order',
  prompt: { blocks: [] },
  config: {
    items: [
      { id: 'a', label: 'First' },
      { id: 'b', label: 'Second' },
      { id: 'c', label: 'Third' },
    ],
    evaluationMode: 'exact',
  },
  evaluation: { mode: 'automatic', points: 3 },
  completion: { required: true },
  presentation: {
    defaultSurface: 'inline',
    allowInline: true,
    allowPractice: true,
    preferredWidth: 'compact',
    supportsFullscreen: false,
  },
};

it('supports moving items with buttons and announces the new position', () => {
  render(<RendererHarness Renderer={OrderingActivity} activity={activity} />);
  fireEvent.click(screen.getByRole('button', { name: 'Di chuyển First xuống' }));
  const items = screen.getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('Second');
  expect(items[1]).toHaveTextContent('First');
  expect(screen.getByRole('status')).toHaveTextContent('First ở vị trí 2');
});
