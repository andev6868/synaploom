import type { ActivityPublicView } from '@synaploom/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChoiceActivity } from '#src/features/activity-engine/renderers/ChoiceActivity';
import { RendererHarness } from '#src/features/activity-engine/renderers/test-utils';

const single: ActivityPublicView = {
  id: 'single',
  kind: 'single-choice',
  title: 'Choose one',
  prompt: { blocks: [] },
  config: {
    options: [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ],
  },
  evaluation: { mode: 'automatic', points: 1 },
  completion: { required: true },
};

const multiple: ActivityPublicView = {
  ...single,
  id: 'multiple',
  kind: 'multiple-choice',
  title: 'Choose many',
  config: {
    options: [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ],
    evaluationMode: 'exact-set',
  },
};

describe('ChoiceActivity', () => {
  it('supports arrow-key navigation for single-choice radios', () => {
    render(<RendererHarness Renderer={ChoiceActivity} activity={single} />);
    const alpha = screen.getByRole('radio', { name: 'Alpha' });
    const beta = screen.getByRole('radio', { name: 'Beta' });
    alpha.focus();
    fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    expect(beta).toBeChecked();
    expect(beta).toHaveFocus();
  });

  it('tracks the exact set selected by multiple-choice checkboxes', () => {
    render(<RendererHarness Renderer={ChoiceActivity} activity={multiple} />);
    const alpha = screen.getByRole('checkbox', { name: 'Alpha' });
    const beta = screen.getByRole('checkbox', { name: 'Beta' });
    fireEvent.click(alpha);
    fireEvent.click(beta);
    expect(alpha).toBeChecked();
    expect(beta).toBeChecked();
    fireEvent.click(alpha);
    expect(alpha).not.toBeChecked();
    expect(beta).toBeChecked();
  });
});
