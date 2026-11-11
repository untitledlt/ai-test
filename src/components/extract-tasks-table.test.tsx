import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { getDoc, putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import { ExtractTasksTable } from './extract-tasks-table';
import type { ExtractTask } from '../lib/extract-utils';
import type { ExtractionCallResult } from '../types';
import type { AppSettings, ProviderProfile } from '../db/types';

const TASKS: ExtractTask[] = [
  { id: 'a', model: 'model-a', excluded: false },
  { id: 'b', model: 'model-b', excluded: false },
];

vi.mock('../lib/openrouter-client', () => ({
  listVisionModelOptions: vi.fn().mockResolvedValue([]),
}));

import { listVisionModelOptions } from '../lib/openrouter-client';

afterEach(() => {
  vi.clearAllMocks();
});

async function seedActiveProvider(): Promise<ProviderProfile> {
  const now = new Date().toISOString();
  const provider: ProviderProfile = {
    _id: `provider:${randomUUID()}`,
    type: 'provider',
    label: 'Real',
    serverURL: 'https://example.test',
    apiKey: 'secret',
    createdAt: now,
    updatedAt: now,
  };
  await putDoc(provider);
  // Earlier tests in this file render components that call useActiveProvider, which lazily
  // creates the app-settings doc in the background; a blind putDoc here can race that and
  // conflict, so read the current _rev (if any) first.
  const existingSettings = await getDoc<AppSettings>('app-settings');
  await putDoc<AppSettings>({
    _id: 'app-settings',
    _rev: existingSettings?._rev,
    type: 'settings',
    activeProviderId: provider._id,
    syncEnabled: false,
  });
  return provider;
}

describe('ExtractTasksTable', () => {
  it('renders one editable model field per task', () => {
    renderWithProviders(
      <ExtractTasksTable
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
      <ExtractTasksTable
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
      <ExtractTasksTable
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

  it('renders the extracted JSON for a successful call', () => {
    const results: Record<string, ExtractionCallResult[]> = {
      a: [
        {
          success: true,
          durationMs: 100,
          data: {
            data: { merchant: 'Acme', total: 12.5 },
            usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520, cost: 0.003 },
          },
        },
      ],
    };
    renderWithProviders(
      <ExtractTasksTable
        tasks={TASKS}
        resultsByTaskId={results}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );
    expect(screen.getByText(/"merchant": "Acme"/)).toBeInTheDocument();
  });

  it('shows the error message for a failed call', () => {
    const results: Record<string, ExtractionCallResult[]> = {
      a: [{ success: false, error: 'boom', durationMs: 50 }],
    };
    renderWithProviders(
      <ExtractTasksTable
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
    const results: Record<string, ExtractionCallResult[]> = {
      a: [
        { success: true, durationMs: 100, data: { data: {}, usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20, cost: 0.001 } } },
        { success: true, durationMs: 100, data: { data: {}, usage: { prompt_tokens: 10, completion_tokens: 30, total_tokens: 40, cost: 0.001 } } },
      ],
    };
    renderWithProviders(
      <ExtractTasksTable
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

  it("shows a price next to a model suggestion once vision model options load", async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    vi.mocked(listVisionModelOptions).mockResolvedValueOnce([
      { id: 'model-a', promptPrice: 0.000002, completionPrice: 0.00001 },
    ]);
    renderWithProviders(
      <ExtractTasksTable
        tasks={TASKS}
        resultsByTaskId={{}}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );

    const modelField = screen.getAllByPlaceholderText('Model')[0];
    await user.click(modelField);
    await waitFor(() => expect(screen.getByText('in $2.00 · out $10.00 /1M tok')).toBeInTheDocument());
  });
});
