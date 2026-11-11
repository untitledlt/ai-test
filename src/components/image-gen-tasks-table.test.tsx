import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { getDoc, putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import { ImageGenTasksTable } from './image-gen-tasks-table';
import type { ImageGenTask } from '../lib/image-gen-utils';
import type { ImageGenCallResult } from '../types';
import type { AppSettings, ProviderProfile } from '../db/types';

const TASKS: ImageGenTask[] = [
  { id: 'a', model: 'model-a', excluded: false },
  { id: 'b', model: 'model-b', excluded: false },
];

vi.mock('../lib/openrouter-client', () => ({
  listImageModelOptions: vi.fn().mockResolvedValue([]),
  getCheapestImageOutputPrice: vi.fn().mockResolvedValue(undefined),
}));

import { getCheapestImageOutputPrice, listImageModelOptions } from '../lib/openrouter-client';

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

describe('ImageGenTasksTable', () => {
  it('renders one editable model field per task', () => {
    renderWithProviders(
      <ImageGenTasksTable
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
      <ImageGenTasksTable
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
      <ImageGenTasksTable
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

  it('renders the generated image for a successful call', () => {
    const results: Record<string, ImageGenCallResult[]> = {
      a: [
        {
          success: true,
          durationMs: 100,
          data: {
            images: [{ dataUrl: 'data:image/jpeg;base64,AAA', mediaType: 'image/jpeg' }],
            usage: { prompt_tokens: 10, completion_tokens: 1000, total_tokens: 1010, cost: 0.01 },
          },
        },
      ],
    };
    renderWithProviders(
      <ImageGenTasksTable
        tasks={TASKS}
        resultsByTaskId={results}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );
    const img = screen.getByRole('img', { name: /generated/i });
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,AAA');
  });

  it('opens a full-size dialog when a generated image thumbnail is clicked', async () => {
    const user = userEvent.setup();
    const results: Record<string, ImageGenCallResult[]> = {
      a: [
        {
          success: true,
          durationMs: 100,
          data: {
            images: [{ dataUrl: 'data:image/jpeg;base64,AAA', mediaType: 'image/jpeg' }],
            usage: { prompt_tokens: 10, completion_tokens: 1000, total_tokens: 1010, cost: 0.01 },
          },
        },
      ],
    };
    renderWithProviders(
      <ImageGenTasksTable
        tasks={TASKS}
        resultsByTaskId={results}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /view larger/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img', { name: /generated/i })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,AAA',
    );
  });

  it('shows the error message for a failed call', () => {
    const results: Record<string, ImageGenCallResult[]> = {
      a: [{ success: false, error: 'boom', durationMs: 50 }],
    };
    renderWithProviders(
      <ImageGenTasksTable
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

  it('shows Aspect ratio and Resolution selects populated from that task\'s model options', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'model-a', aspectRatios: ['1:1', '16:9'], resolutions: ['1K', '2K'], supportsImageInput: true },
    ]);
    renderWithProviders(
      <ImageGenTasksTable
        tasks={TASKS}
        resultsByTaskId={{}}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );

    expect(screen.getByText('Aspect ratio')).toBeInTheDocument();
    expect(screen.getByText('Resolution')).toBeInTheDocument();

    const aspectTrigger = screen.getAllByRole('combobox')[0];
    await waitFor(() => expect(aspectTrigger).not.toHaveAttribute('data-disabled'));
    await user.click(aspectTrigger);
    await waitFor(() => expect(screen.getByRole('option', { name: '16:9' })).toBeInTheDocument());
  });

  it('calls onTaskChange with the picked aspect ratio, and undefined for Auto', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'model-a', aspectRatios: ['1:1', '16:9'], resolutions: ['1K'], supportsImageInput: true },
    ]);
    const onTaskChange = vi.fn();
    renderWithProviders(
      <ImageGenTasksTable
        tasks={TASKS}
        resultsByTaskId={{}}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={onTaskChange}
        onRemoveTask={() => {}}
      />,
    );

    const aspectTrigger = screen.getAllByRole('combobox')[0];
    await waitFor(() => expect(aspectTrigger).not.toHaveAttribute('data-disabled'));
    await user.click(aspectTrigger);
    await waitFor(() => expect(screen.getByRole('option', { name: '16:9' })).toBeInTheDocument());
    await user.click(screen.getByRole('option', { name: '16:9' }));

    expect(onTaskChange).toHaveBeenCalledWith('a', { aspectRatio: '16:9' });
  });

  it('disables the Aspect ratio select when the task\'s model has no aspect-ratio options', async () => {
    await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'model-a', aspectRatios: [], resolutions: [], supportsImageInput: true },
    ]);
    renderWithProviders(
      <ImageGenTasksTable
        tasks={TASKS}
        resultsByTaskId={{}}
        progressByTaskId={{}}
        isRunning={false}
        callCount={1}
        onTaskChange={() => {}}
        onRemoveTask={() => {}}
      />,
    );

    await waitFor(() => expect(listImageModelOptions).toHaveBeenCalled());
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveAttribute('data-disabled');
  });

  it("shows a price next to a model suggestion once that model's price is fetched", async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'model-a', aspectRatios: [], resolutions: [], supportsImageInput: true },
    ]);
    vi.mocked(getCheapestImageOutputPrice).mockResolvedValueOnce({ costUsd: 0.0184, unit: 'image' });
    renderWithProviders(
      <ImageGenTasksTable
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
    await waitFor(() => expect(screen.getByText('from $0.0184/image')).toBeInTheDocument());
  });

  it('computes the average tokens per call across successful results', () => {
    const results: Record<string, ImageGenCallResult[]> = {
      a: [
        { success: true, durationMs: 100, data: { images: [], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20, cost: 0.001 } } },
        { success: true, durationMs: 100, data: { images: [], usage: { prompt_tokens: 10, completion_tokens: 30, total_tokens: 40, cost: 0.001 } } },
      ],
    };
    renderWithProviders(
      <ImageGenTasksTable
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
