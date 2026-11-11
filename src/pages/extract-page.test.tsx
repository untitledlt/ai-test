import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { allDocsByPrefix, putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { ExtractRecord, ProviderProfile } from '../db/types';

afterEach(() => {
  localStorage.clear();
});

vi.mock('../lib/openrouter-client', () => ({
  submitExtraction: vi.fn().mockResolvedValue({
    data: { merchant: 'Acme', total: 12.5 },
    usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520, cost: 0.003 },
  }),
  listVisionModelOptions: vi.fn().mockResolvedValue([]),
}));

import { ExtractPage } from './extract-page';
import { submitExtraction } from '../lib/openrouter-client';

const DRAFT_KEY = 'ai-test-agent:extract-draft';
const ONE_IMAGE = [{ id: 'img1', dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'receipt.jpg' }];

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

describe('ExtractPage', () => {
  it('shows a configure-provider callout and disables Start when there is no active provider', async () => {
    renderWithProviders(<ExtractPage />);
    expect(await screen.findByText(/Configure a provider in Settings before submitting/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('keeps Start disabled when no images are added', async () => {
    await seedActiveProvider();
    renderWithProviders(<ExtractPage />);
    await screen.findByPlaceholderText('Model');
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('keeps Start disabled when the schema is not valid JSON', async () => {
    await seedActiveProvider();
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: '',
        instructions: '',
        schema: 'not json',
        inputImages: ONE_IMAGE,
        tasks: [{ id: 't1', model: 'vision-model', excluded: false }],
        callCount: 1,
      }),
    );
    renderWithProviders(<ExtractPage />);
    await screen.findByDisplayValue('vision-model');
    expect(screen.getByText('Schema is not valid JSON')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('adds a second model task via Add model', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<ExtractPage />);
    await screen.findByPlaceholderText('Model');

    await user.click(screen.getByRole('button', { name: 'Add model' }));

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Model')).toHaveLength(2);
  });

  it('lets Calls per model be cleared and retyped without adding a model', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<ExtractPage />);
    await screen.findByPlaceholderText('Model');

    const callsField = screen.getByLabelText('Calls per model') as HTMLInputElement;
    expect(callsField.value).toBe('1');

    await user.click(callsField);
    await user.keyboard('{End}{Backspace}');
    await user.type(callsField, '7');

    expect(callsField.value).toBe('7');
  });

  it('runs callCount calls per non-excluded task and shows the extracted JSON', async () => {
    const user = userEvent.setup();
    const provider = await seedActiveProvider();
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: '',
        instructions: 'Extract the receipt',
        schema: '{"type":"object"}',
        inputImages: ONE_IMAGE,
        tasks: [{ id: 't1', model: 'vision-model', excluded: false }],
        callCount: 2,
      }),
    );
    renderWithProviders(<ExtractPage />);
    await screen.findByDisplayValue('vision-model');
    const startButton = await screen.findByRole('button', { name: /Start/ });
    await vi.waitFor(() => expect(startButton).not.toBeDisabled());

    await user.click(startButton);

    await vi.waitFor(() => {
      expect(screen.getAllByText(/"merchant": "Acme"/)).toHaveLength(2);
    });

    expect(submitExtraction).toHaveBeenCalledWith(
      expect.objectContaining({
        serverURL: provider.serverURL,
        apiKey: provider.apiKey,
        model: 'vision-model',
        instructions: 'Extract the receipt',
        schema: { type: 'object' },
        inputImageDataUrls: ['data:image/jpeg;base64,AAA'],
      }),
    );
  });

  it('sends the default instructions when the instructions field is left blank', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: '',
        instructions: '',
        schema: '{"type":"object"}',
        inputImages: ONE_IMAGE,
        tasks: [{ id: 't1', model: 'vision-model', excluded: false }],
        callCount: 1,
      }),
    );
    renderWithProviders(<ExtractPage />);
    await screen.findByDisplayValue('vision-model');
    const startButton = await screen.findByRole('button', { name: /Start/ });
    await vi.waitFor(() => expect(startButton).not.toBeDisabled());

    await user.click(startButton);

    await vi.waitFor(() => {
      expect(submitExtraction).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'Extract the requested fields from the attached image(s) according to the provided JSON schema.',
        }),
      );
    });
  });

  it('disables Start once the only model task is excluded', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: '', instructions: '', schema: '{}', inputImages: ONE_IMAGE, tasks: [{ id: 't1', model: 'vision-model', excluded: false }], callCount: 1 }));
    renderWithProviders(<ExtractPage />);
    await screen.findByDisplayValue('vision-model');
    const startButton = screen.getByRole('button', { name: /Start/ });
    await vi.waitFor(() => expect(startButton).not.toBeDisabled());

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('starts a run via Cmd/Ctrl+Enter', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: '', instructions: '', schema: '{}', inputImages: ONE_IMAGE, tasks: [{ id: 't1', model: 'vision-model', excluded: false }], callCount: 1 }));
    renderWithProviders(<ExtractPage />);
    await screen.findByDisplayValue('vision-model');
    const startButton = screen.getByRole('button', { name: /Start/ });
    await vi.waitFor(() => expect(startButton).not.toBeDisabled());

    await user.keyboard('{Control>}{Enter}{/Control}');

    await vi.waitFor(() => {
      expect(submitExtraction).toHaveBeenCalled();
    });
  });

  it('does not start a run via Cmd/Ctrl+Enter when Start is disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExtractPage />);
    await screen.findByPlaceholderText('Model');

    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(submitExtraction).not.toHaveBeenCalled();
  });

  it('persists tasks, instructions, and schema via Save As, and reloads them on a fresh mount', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExtractPage />);

    await user.type(await screen.findByPlaceholderText(/Extract the requested fields/), 'Custom instructions');
    await user.click(screen.getByRole('button', { name: 'Add model' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText('Record name'), 'Grocery receipt');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await screen.findByText('Grocery receipt');

    const records = await allDocsByPrefix<ExtractRecord>('extract:');
    expect(records).toHaveLength(1);
    const content = JSON.parse(records[0].content);
    expect(content.tasks).toHaveLength(2);
    expect(content.instructions).toBe('Custom instructions');
  });
});
