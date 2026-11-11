import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { renderWithProviders } from '../test/render';
import { allDocsByPrefix, putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { ImageGenRecord, ProviderProfile } from '../db/types';

afterEach(() => {
  localStorage.clear();
});

vi.mock('../lib/openrouter-client', () => ({
  submitImageGeneration: vi.fn().mockResolvedValue({
    images: [{ dataUrl: 'data:image/jpeg;base64,AAA', mediaType: 'image/jpeg' }],
    usage: { prompt_tokens: 50, completion_tokens: 0, total_tokens: 50, cost: 0.01 },
  }),
  listImageModelOptions: vi.fn().mockResolvedValue([]),
  getCheapestImageOutputPrice: vi.fn().mockResolvedValue(undefined),
}));

import { ImagePage } from './image-page';
import { listImageModelOptions, submitImageGeneration } from '../lib/openrouter-client';

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
  await putDoc({ _id: 'app-settings', type: 'settings', activeProviderId: provider._id, syncEnabled: false });
  return provider;
}

describe('ImagePage', () => {
  it('caps demo controls and blocks a loaded oversized payload before any API call', async () => {
    const user = userEvent.setup();
    const provider = await seedActiveProvider();
    const { DEMO_URL } = await import('../lib/onboarding');
    const { getDoc } = await import('../db/client');
    await putDoc({ ...(await getDoc<ProviderProfile>(provider._id))!, serverURL: DEMO_URL });
    vi.mocked(submitImageGeneration).mockClear();
    const error = vi.spyOn(toast, 'error');
    renderWithProviders(<ImagePage />);
    await screen.findByText(/Demo limits:/);
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Add model' }));
    expect(screen.getByRole('button', { name: 'Add model' })).toBeDisabled();
    for (const field of screen.getAllByPlaceholderText('Model')) fireEvent.change(field, { target: { value: 'demo/image' } });
    const calls = screen.getByRole('spinbutton', { name: 'Calls per model' });
    fireEvent.change(calls, { target: { value: '9' } });
    await user.tab();
    expect(calls).toHaveAttribute('max', '2');
    fireEvent.change(screen.getByPlaceholderText('Describe the image to generate'), {
      target: { value: 'x'.repeat(65536) },
    });
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('64 KiB'));
    expect(submitImageGeneration).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('shows a configure-provider callout and disables Start when there is no active provider', async () => {
    renderWithProviders(<ImagePage />);
    expect(await screen.findByText(/Configure a provider in Settings before submitting/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('keeps Start disabled when no prompt is entered', async () => {
    await seedActiveProvider();
    renderWithProviders(<ImagePage />);
    await screen.findByPlaceholderText('Model');
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('adds a second model task via Add model', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<ImagePage />);
    await screen.findByPlaceholderText('Model');

    await user.click(screen.getByRole('button', { name: 'Add model' }));

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Model')).toHaveLength(2);
  });

  it('lets Calls per model be cleared and retyped without adding a model', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<ImagePage />);
    await screen.findByPlaceholderText('Model');

    const callsField = screen.getByLabelText('Calls per model') as HTMLInputElement;
    expect(callsField.value).toBe('1');

    await user.click(callsField);
    await user.keyboard('{End}{Backspace}');
    await user.type(callsField, '7');

    expect(callsField.value).toBe('7');
  });

  it('runs callCount calls per non-excluded task and shows a generated image', async () => {
    const user = userEvent.setup();
    const provider = await seedActiveProvider();
    renderWithProviders(<ImagePage />);
    const modelField = await screen.findByPlaceholderText('Model');
    await user.type(modelField, 'img-model');

    const promptField = screen.getByPlaceholderText('Describe the image to generate');
    await user.type(promptField, 'A cat in a hat');

    const callsField = screen.getByLabelText('Calls per model');
    fireEvent.change(callsField, { target: { value: '2' } });

    await user.click(screen.getByRole('button', { name: /Start/ }));

    await vi.waitFor(() => {
      expect(screen.getAllByRole('img', { name: /generated/i })).toHaveLength(2);
    });

    expect(submitImageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        serverURL: provider.serverURL,
        apiKey: provider.apiKey,
        model: 'img-model',
        prompt: 'A cat in a hat',
      }),
    );
  });

  it('persists and sends the chosen aspect ratio and resolution', async () => {
    const user = userEvent.setup();
    const provider = await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'img-model', aspectRatios: ['16:9'], resolutions: ['2K'], supportsImageInput: true },
    ]);
    renderWithProviders(<ImagePage />);
    const modelField = await screen.findByPlaceholderText('Model');
    await user.type(modelField, 'img-model');
    await user.type(screen.getByPlaceholderText('Describe the image to generate'), 'A cat in a hat');

    const aspectTrigger = within(screen.getByRole('table')).getAllByRole('combobox')[0];
    await vi.waitFor(() => expect(aspectTrigger).not.toHaveAttribute('data-disabled'));
    await user.click(aspectTrigger);
    await user.click(await screen.findByRole('option', { name: '16:9' }));

    const resolutionTrigger = within(screen.getByRole('table')).getAllByRole('combobox')[1];
    await user.click(resolutionTrigger);
    await user.click(await screen.findByRole('option', { name: '2K' }));

    await user.click(screen.getByRole('button', { name: /Start/ }));

    await vi.waitFor(() => {
      expect(submitImageGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          serverURL: provider.serverURL,
          apiKey: provider.apiKey,
          aspectRatio: '16:9',
          resolution: '2K',
        }),
      );
    });
  });

  it("skips a task's call and shows a notification when the model doesn't accept image input, without blocking other tasks", async () => {
    const user = userEvent.setup();
    const provider = await seedActiveProvider();
    localStorage.setItem(
      'ai-test-agent:image-gen-draft',
      JSON.stringify({
        name: '',
        prompt: 'A cat in a hat',
        inputImages: [{ id: 'img1', dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'photo.jpg' }],
        tasks: [
          { id: 'text-only', model: 'text-only-model', excluded: false },
          { id: 'image-ok', model: 'image-capable-model', excluded: false },
        ],
        callCount: 1,
      }),
    );
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'text-only-model', aspectRatios: [], resolutions: [], supportsImageInput: false },
      { id: 'image-capable-model', aspectRatios: [], resolutions: [], supportsImageInput: true },
    ]);
    const toastErrorSpy = vi.spyOn(toast, 'error');
    renderWithProviders(<ImagePage />);
    await screen.findByDisplayValue('text-only-model');
    const startButton = await screen.findByRole('button', { name: /Start/ });
    await vi.waitFor(() => expect(startButton).not.toBeDisabled());

    await user.click(startButton);

    await vi.waitFor(() => {
      expect(submitImageGeneration).toHaveBeenCalledWith(
        expect.objectContaining({ serverURL: provider.serverURL, apiKey: provider.apiKey, model: 'image-capable-model' }),
      );
    });

    expect(submitImageGeneration).not.toHaveBeenCalledWith(
      expect.objectContaining({ model: 'text-only-model' }),
    );
    expect(toastErrorSpy).toHaveBeenCalledWith(expect.stringContaining('text-only-model'));
  });

  it('disables Start once the only model task is excluded', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<ImagePage />);
    const modelField = await screen.findByPlaceholderText('Model');
    await user.type(modelField, 'img-model');
    await user.type(screen.getByPlaceholderText('Describe the image to generate'), 'A cat in a hat');
    expect(screen.getByRole('button', { name: /Start/ })).not.toBeDisabled();

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('starts a run via Cmd/Ctrl+Enter', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<ImagePage />);
    const modelField = await screen.findByPlaceholderText('Model');
    await user.type(modelField, 'img-model');
    await user.type(screen.getByPlaceholderText('Describe the image to generate'), 'A cat in a hat');

    await user.keyboard('{Control>}{Enter}{/Control}');

    await vi.waitFor(() => {
      expect(screen.getAllByRole('img', { name: /generated/i })).toHaveLength(1);
    });
  });

  it('does not start a run via Cmd/Ctrl+Enter when Start is disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImagePage />);
    await screen.findByPlaceholderText('Model');

    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(submitImageGeneration).not.toHaveBeenCalled();
  });

  it('persists tasks, prompt, and callCount via Save As, and reloads them on a fresh mount', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImagePage />);

    await user.type(await screen.findByPlaceholderText('Describe the image to generate'), 'A cat in a hat');
    await user.click(screen.getByRole('button', { name: 'Add model' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText('Record name'), 'Two models');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await screen.findByText('Two models');

    const records = await allDocsByPrefix<ImageGenRecord>('image-gen:');
    expect(records).toHaveLength(1);
    const content = JSON.parse(records[0].content);
    expect(content.tasks).toHaveLength(2);
    expect(content.prompt).toBe('A cat in a hat');
  });
});
