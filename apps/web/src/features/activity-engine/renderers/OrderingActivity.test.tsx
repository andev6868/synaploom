import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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

it('renders a visual drag affordance while preserving keyboard move controls', () => {
  render(<RendererHarness Renderer={OrderingActivity} activity={activity} />);

  expect(screen.getByText('Kéo và thả để sắp xếp theo trình tự đúng.')).toBeVisible();
  expect(document.querySelectorAll('[data-ordering-drag-handle]')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Di chuyển First xuống' })).toBeEnabled();
});

it('asks AI about an item without reordering or changing the answer', () => {
  const onChange = vi.fn();
  const onAskAIAboutItem = vi.fn();

  render(
    <OrderingActivity
      activity={activity}
      answer={{ kind: 'ordering', itemIds: ['a', 'b', 'c'] }}
      disabled={false}
      onChange={onChange}
      onSaveDraft={() => Promise.resolve()}
      onSubmit={() => Promise.resolve()}
      onAskAIAboutItem={onAskAIAboutItem}
    />,
  );

  const button = screen.getByRole('button', { name: 'Hỏi AI về bước Second' });
  expect(button.closest('[data-ordering-drag-handle]')).toBeNull();
  fireEvent.click(button);

  expect(onAskAIAboutItem).toHaveBeenCalledWith(
    { label: 'Second', selectedText: 'Second' },
    expect.any(HTMLButtonElement),
  );
  expect(onChange).not.toHaveBeenCalled();
});
