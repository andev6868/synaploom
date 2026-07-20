import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppHeader } from '#ui/components/app-header/app-header';

it('renders brand divider, navigation, and trailing content as distinct regions', () => {
  render(<AppHeader navigation={<nav>Learning navigation</nav>} trailing={<span>Local</span>} />);

  expect(screen.getByText('Synaploom')).toBeVisible();
  expect(screen.getByTestId('app-header-divider')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('navigation')).toBeVisible();
  expect(screen.getByText('Local')).toBeVisible();
});
