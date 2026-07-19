import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { NumericActivity } from '#src/features/activity-engine/renderers/NumericActivity';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';

const activity: ActivityPublicView = {
  id: 'numeric',
  kind: 'numeric',
  title: 'Calculate',
  prompt: { blocks: [] },
  config: { answerMode: 'expression', unit: 'm/s', requireUnit: true },
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

it('keeps the source expression and exposes the required unit selector', () => {
  render(<RendererHarness Renderer={NumericActivity} activity={activity} />);
  const input = screen.getByRole('textbox', { name: 'Giá trị hoặc biểu thức' });
  const unit = screen.getByRole('combobox', { name: 'Đơn vị' });
  fireEvent.change(input, { target: { value: '2 * pi' } });
  fireEvent.change(unit, { target: { value: 'm/s' } });
  expect(input).toHaveValue('2 * pi');
  expect(unit).toHaveValue('m/s');
});
