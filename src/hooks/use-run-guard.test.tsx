import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { useRunGuard } from './use-run-guard';

function Harness() {
  const guard = useRunGuard(null);
  const [runs, setRuns] = useState(0);
  async function start() {
    if (!await guard.approve({ taskCount: 6, activeTaskCount: 6, callCount: 1, payloads: [{}] })) return;
    setRuns((value) => value + 1);
    guard.finish();
  }
  return <>{guard.ui}<button onClick={start}>Start</button><output>Runs: {runs}</output></>;
}

describe('run confirmation', () => {
  it('does not run before approval, cancels on Escape, and asks again for the next run', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(screen.getByText('Start'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('6 requests');
    expect(screen.getByText('Runs: 0')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByText('Start'));
    await user.click(screen.getByText('Run anyway'));
    await waitFor(() => expect(screen.getByText('Runs: 1')).toBeInTheDocument());
    await user.click(screen.getByText('Start'));
    await user.click(screen.getByText('Cancel'));
    expect(screen.getByText('Runs: 1')).toBeInTheDocument();
  });
});
