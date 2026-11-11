import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { ResultPanel } from './result-panel';
import type { AiTestAgentResult } from '../types';

const sampleResult: AiTestAgentResult = {
  id: 'gen-1',
  model: 'anthropic/claude-sonnet-5',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content: 'Hello there', reasoning: 'thinking about it' },
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, cost: 0.000123 },
};

describe('ResultPanel', () => {
  it('shows a placeholder when there is no result', () => {
    renderWithProviders(<ResultPanel result={null} durationMs={null} onAppendToMessages={() => {}} />);
    expect(screen.getByText('Submit to see a result')).toBeInTheDocument();
  });

  it('renders formatted stats', () => {
    renderWithProviders(<ResultPanel result={sampleResult} durationMs={1500} onAppendToMessages={() => {}} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('$0.000123')).toBeInTheDocument();
    expect(screen.getByText('1.50s')).toBeInTheDocument();
  });

  it('shows human readable content and reasoning by default', () => {
    renderWithProviders(<ResultPanel result={sampleResult} durationMs={100} onAppendToMessages={() => {}} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
    expect(screen.getByText('thinking about it')).toBeInTheDocument();
  });

  it('switches to raw JSON view', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultPanel result={sampleResult} durationMs={100} onAppendToMessages={() => {}} />);

    await user.click(screen.getByRole('radio', { name: 'Raw JSON' }));
    expect(screen.queryByText('Hello there')).not.toBeInTheDocument();
    expect(screen.getByText(/"finish_reason"/)).toBeInTheDocument();
  });

  it('calls onAppendToMessages when the button is clicked', async () => {
    const user = userEvent.setup();
    const onAppend = vi.fn();
    renderWithProviders(<ResultPanel result={sampleResult} durationMs={100} onAppendToMessages={onAppend} />);

    await user.click(screen.getByRole('button', { name: 'Append to messages' }));
    expect(onAppend).toHaveBeenCalledTimes(1);
  });

  it('shows an em dash for duration when not yet measured', () => {
    renderWithProviders(<ResultPanel result={sampleResult} durationMs={null} onAppendToMessages={() => {}} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
