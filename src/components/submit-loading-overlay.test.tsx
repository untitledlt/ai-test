import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Theme } from '@radix-ui/themes';
import { SubmitLoadingOverlay } from './submit-loading-overlay';

afterEach(() => {
  vi.useRealTimers();
});

describe('SubmitLoadingOverlay', () => {
  it('renders nothing while inactive', () => {
    render(
      <Theme>
        <SubmitLoadingOverlay active={false} />
      </Theme>,
    );
    expect(screen.queryByText(/s$/)).not.toBeInTheDocument();
  });

  it('shows a running elapsed-time counter while active', () => {
    vi.useFakeTimers();
    render(
      <Theme>
        <SubmitLoadingOverlay active={true} />
      </Theme>,
    );

    expect(screen.getByText('0.0s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });

  it('resets the counter back to zero the next time it becomes active', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Theme>
        <SubmitLoadingOverlay active={true} />
      </Theme>,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.getByText('0.9s')).toBeInTheDocument();

    rerender(
      <Theme>
        <SubmitLoadingOverlay active={false} />
      </Theme>,
    );
    rerender(
      <Theme>
        <SubmitLoadingOverlay active={true} />
      </Theme>,
    );

    expect(screen.getByText('0.0s')).toBeInTheDocument();
  });
});
