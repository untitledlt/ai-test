import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { SaveAsDialog } from './save-as-dialog';

describe('SaveAsDialog', () => {
  it('disables Save while the name is blank', () => {
    renderWithProviders(<SaveAsDialog open onOpenChange={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('enables Save once a name is typed and calls onSave with the trimmed name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<SaveAsDialog open onOpenChange={onOpenChange} onSave={onSave} />);

    await user.type(screen.getByPlaceholderText('Record name'), '  My record  ');
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledWith('My record');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('pre-fills the name from initialName when opened', () => {
    renderWithProviders(<SaveAsDialog open onOpenChange={() => {}} onSave={() => {}} initialName="Existing" />);
    expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();
  });

  it('renders nothing interactive when closed', () => {
    renderWithProviders(<SaveAsDialog open={false} onOpenChange={() => {}} onSave={() => {}} />);
    expect(screen.queryByPlaceholderText('Record name')).not.toBeInTheDocument();
  });
});
