import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { MultipleTasksTable } from './multiple-tasks-table';

vi.mock('../hooks/use-chat-models', () => ({ useChatModelOptions: () => ({ optionsById: new Map([['tools-only', { id: 'tools-only', supportsReasoning: false }]]) }) }));

describe('response row test summaries', () => {
  it('totals checks across displayed tasks for each call index and leaves untested rows blank', () => {
    renderWithProviders(<MultipleTasksTable
      tasks={[{ id: 'a', model: 'a', temperature: 0.7 }, { id: 'b', model: 'b', temperature: 0.7 }]}
      resultsByTaskId={{}} progressByTaskId={{}} isRunning={false} callCount={3}
      onTaskChange={vi.fn()} onRemoveTask={vi.fn()}
      testResultsByTaskId={{
        a: { 0: [{ name: 'one', pass: true }, { name: 'two', pass: false }], 1: [{ name: 'one', pass: true }] },
        b: { 0: [{ name: 'one', pass: true }] },
        removed: { 0: [{ name: 'ignored', pass: false }] },
      }}
    />);
    const first = screen.getByText('Response #1').closest('tr')!;
    const second = screen.getByText('Response #2').closest('tr')!;
    const third = screen.getByText('Response #3').closest('tr')!;
    expect(within(first).getByText('2/3 passed')).toHaveAttribute('data-accent-color', 'red');
    expect(within(second).getByText('1/1 passed')).toHaveAttribute('data-accent-color', 'green');
    expect(within(third).queryByText(/passed/)).not.toBeInTheDocument();
  });
});

describe('reasoning capability controls', () => {
  it('disables unsupported defaults, preserves saved reasoning and lets it be reset', () => {
    renderWithProviders(<MultipleTasksTable
      tasks={[{ id: 'a', model: 'tools-only', temperature: 1 }, { id: 'b', model: 'tools-only', temperature: 1, reasoningEffort: 'medium' }, { id: 'c', model: 'custom', temperature: 1 }]}
      resultsByTaskId={{}} progressByTaskId={{}} testResultsByTaskId={{}} isRunning={false} callCount={1}
      onTaskChange={vi.fn()} onRemoveTask={vi.fn()}
    />);
    const row = screen.getByText('Reasoning effort').closest('tr')!;
    const controls = within(row).getAllByRole('combobox');
    expect(controls[0]).toBeDisabled();
    expect(controls[1]).toBeEnabled();
    expect(controls[1]).toHaveTextContent('Medium');
    expect(controls[2]).toBeEnabled();
    expect(within(row).getByText(/Choose Default or another model/)).toBeInTheDocument();
  });
});
