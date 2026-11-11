import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { BatchRunControls } from './batch-run-controls';
import { MultipleToolbar } from './multiple-toolbar';

function ChatBatchControls({ onStart }: { onStart: (count: number) => void }) {
  const [count, setCount] = useState(1);
  return (
    <MultipleToolbar
      callCount={count}
      onCallCountChange={setCount}
      onAddTask={() => {}}
      onStart={() => onStart(count)}
      isRunning={false}
      history={[]}
      historySelection="live"
      onHistorySelectionChange={() => {}}
    />
  );
}

describe('shared batch controls', () => {
  it('lets the chat call count be cleared and retyped, and restores an empty draft on blur', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    renderWithProviders(<ChatBatchControls onStart={onStart} />);
    const input = screen.getByRole('spinbutton', { name: 'Calls per task' });
    await user.clear(input);
    expect(input).toHaveValue(null);
    await user.type(input, '7');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenLastCalledWith(7);
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue(7);
  });

  it.each([['0', 1], ['21', 20], ['2.6', 3]])('clamps %s to %s calls', async (raw, expected) => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    renderWithProviders(<ChatBatchControls onStart={onStart} />);
    await user.click(screen.getByRole('spinbutton'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: raw } });
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledWith(expected);
    expect(screen.getByRole('spinbutton')).toHaveValue(expected);
  });

  it('disables count, add, and start while a batch is running', () => {
    renderWithProviders(
      <BatchRunControls callCount={1} onCallCountChange={vi.fn()} onStart={vi.fn()} onAddTask={vi.fn()} isRunning />,
    );
    expect(screen.getByRole('spinbutton', { name: 'Calls per model' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});
