import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { ZoomableImage } from './zoomable-image';

describe('ZoomableImage', () => {
  it('renders a clickable thumbnail with the given src and alt', () => {
    renderWithProviders(<ZoomableImage src="data:image/jpeg;base64,AAA" alt="A receipt" />);

    const thumbnail = screen.getByRole('img', { name: 'A receipt' });
    expect(thumbnail).toHaveAttribute('src', 'data:image/jpeg;base64,AAA');
  });

  it('does not show the full-size dialog until the thumbnail is clicked', () => {
    renderWithProviders(<ZoomableImage src="data:image/jpeg;base64,AAA" alt="A receipt" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a dialog with the full-size image when the thumbnail is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ZoomableImage src="data:image/jpeg;base64,AAA" alt="A receipt" />);

    await user.click(screen.getByRole('button', { name: /view larger/i }));

    const dialog = await screen.findByRole('dialog');
    const { getByRole } = within(dialog);
    expect(getByRole('img', { name: 'A receipt' })).toHaveAttribute('src', 'data:image/jpeg;base64,AAA');
  });

  it('closes the dialog when its close control is activated', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ZoomableImage src="data:image/jpeg;base64,AAA" alt="A receipt" />);

    await user.click(screen.getByRole('button', { name: /view larger/i }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
