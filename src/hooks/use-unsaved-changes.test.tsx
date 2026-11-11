import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { ConfirmDialog } from '../components/confirm-dialog';
import { useUnsavedChanges } from './use-unsaved-changes';

function Editor({ dirty = true }: { dirty?: boolean }) {
  const isDirtyRef = useRef(dirty);
  const [resets, setResets] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { guardedAction, discardDialogProps } = useUnsavedChanges(isDirtyRef);
  return (
    <>
      <div>Path: {location.pathname}</div>
      <div>Resets: {resets}</div>
      <button onClick={() => guardedAction(() => setResets((count) => count + 1))}>Reset</button>
      <button onClick={() => guardedAction(() => navigate('/new'))}>New</button>
      <button onClick={() => navigate('/records')}>Load</button>
      <ConfirmDialog {...discardDialogProps} />
    </>
  );
}

describe('useUnsavedChanges', () => {
  it('runs clean actions immediately', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Editor dirty={false} />);
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Resets: 1')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('retains dirty state on Stay and runs an approved local action once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByText('Resets: 0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Resets: 1')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('requires only one confirmation when a guarded action navigates', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Editor />);
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Path: /new')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cancels blocked route navigation with Escape and allows a later confirmed navigation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Load' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Path: /')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load' }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Path: /records')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
