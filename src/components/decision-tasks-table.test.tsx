import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { DecisionTasksTable } from './decision-tasks-table';
import type { DecisionTask } from '../lib/decision-utils';
import type { DecisionCallResult } from '../types';

vi.mock('../hooks/use-decision-models', () => ({ useDecisionModelOptions: () => ({ optionsById: new Map(), isLoading: false }) }));

const TASKS: DecisionTask[] = [
  { id: 'a', model: 'model-a', excluded: false },
  { id: 'b', model: 'model-b', excluded: false },
];

describe('DecisionTasksTable', () => {
  it('renders one editable model field per task', () => {
    renderWithProviders(
      <DecisionTasksTable
        tasks={TASKS}
        resultsByTaskId={{}}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('model-a')).toBeInTheDocument();
    expect(screen.getByDisplayValue('model-b')).toBeInTheDocument();
  });

  it('calls onTaskChange when the exclude checkbox is toggled', async () => {
    const user = userEvent.setup();
    const onTaskChange = vi.fn();
    renderWithProviders(
      <DecisionTasksTable
        tasks={TASKS}
        resultsByTaskId={{}}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={onTaskChange}
        onRemoveTask={() => {}}
      />,
    );
    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(onTaskChange).toHaveBeenCalledWith('a', { excluded: true });
  });

  it('calls onRemoveTask when a task header remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemoveTask = vi.fn();
    renderWithProviders(
      <DecisionTasksTable
        tasks={TASKS}
        resultsByTaskId={{}}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={onRemoveTask}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove task 1' }));
    expect(onRemoveTask).toHaveBeenCalledWith('a');
  });

  it('groups every answer from a successful call into one response cell', () => {
    const results: Record<string, DecisionCallResult[]> = {
      a: [
        {
          success: true,
          durationMs: 100,
          data: {
            answers: {
              matches_listing: { type: 'noul', noul: 0.92 },
              category: { type: 'choice', choice: 'bikes', probabilities: { bikes: 0.8, parts: 0.2 } },
            },
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.001 },
          },
        },
      ],
    };
    renderWithProviders(
      <DecisionTasksTable
        tasks={TASKS}
        resultsByTaskId={results}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );
    const codeEl = document.querySelector('code');
    expect(codeEl?.textContent).toBe('matches_listing: 92%\ncategory: bikes (80%)');
  });

  it('shows the error message for a failed call', () => {
    const results: Record<string, DecisionCallResult[]> = {
      a: [{ success: false, error: 'boom', durationMs: 50 }],
    };
    renderWithProviders(
      <DecisionTasksTable
        tasks={TASKS}
        resultsByTaskId={results}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('computes the average tokens per call across successful results', () => {
    const results: Record<string, DecisionCallResult[]> = {
      a: [
        { success: true, durationMs: 100, data: { answers: {}, usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20, cost: 0.001 } } },
        { success: true, durationMs: 100, data: { answers: {}, usage: { prompt_tokens: 10, completion_tokens: 30, total_tokens: 40, cost: 0.001 } } },
      ],
    };
    renderWithProviders(
      <DecisionTasksTable
        tasks={TASKS}
        resultsByTaskId={results}
        progressByTaskId={{}}
        isRunning={false}
        callCount={2}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});
