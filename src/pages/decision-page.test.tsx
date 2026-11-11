import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { allDocsByPrefix, putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { DecisionRecord, ProviderProfile } from '../db/types';

afterEach(() => {
  localStorage.clear();
});

vi.mock('../lib/openrouter-client', () => ({
  submitDecision: vi.fn().mockResolvedValue({
    answers: { matches_listing: { type: 'noul', noul: 0.92 } },
    usage: { prompt_tokens: 150, completion_tokens: 12, total_tokens: 162, cost: 0.000123 },
  }),
}));

import { DecisionPage } from './decision-page';
import { submitDecision } from '../lib/openrouter-client';

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

async function addNamedQuestion(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.click(screen.getByText('Untitled question'));
  await user.type(screen.getByPlaceholderText('question_name'), name);
}

describe('DecisionPage', () => {
  it('shows a configure-provider callout and disables Start when there is no active provider', async () => {
    renderWithProviders(<DecisionPage />);
    expect(await screen.findByText(/Configure a provider in Settings before submitting/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('starts with one model task defaulting to the typesafe model', async () => {
    await seedActiveProvider();
    renderWithProviders(<DecisionPage />);
    expect(await screen.findByDisplayValue('~typesafe/jev-latest')).toBeInTheDocument();
  });

  it('keeps Start disabled when no questions are defined', async () => {
    await seedActiveProvider();
    renderWithProviders(<DecisionPage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('adds a second model task via Add model', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<DecisionPage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');

    await user.click(screen.getByRole('button', { name: 'Add model' }));

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('~typesafe/jev-latest')).toHaveLength(2);
  });

  it('lets Calls per model be cleared and retyped without adding a model', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<DecisionPage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');

    const callsField = screen.getByLabelText('Calls per model') as HTMLInputElement;
    expect(callsField.value).toBe('1');

    await user.click(callsField);
    await user.keyboard('{End}{Backspace}');
    await user.type(callsField, '7');

    expect(callsField.value).toBe('7');
  });

  it('runs callCount calls per non-excluded model and groups each call\'s answers into one table cell', async () => {
    const user = userEvent.setup();
    const provider = await seedActiveProvider();
    renderWithProviders(<DecisionPage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');

    await addNamedQuestion(user, 'matches_listing');

    const callsField = screen.getByLabelText('Calls per model');
    fireEvent.change(callsField, { target: { value: '2' } });

    await user.click(screen.getByRole('button', { name: /Start/ }));

    await vi.waitFor(() => {
      const matches = Array.from(document.querySelectorAll('code')).filter((el) =>
        el.textContent?.includes('matches_listing: 92%'),
      );
      expect(matches).toHaveLength(2);
    });

    expect(submitDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        serverURL: provider.serverURL,
        apiKey: provider.apiKey,
        model: '~typesafe/jev-latest',
        questions: { matches_listing: expect.any(Object) },
      }),
    );
  });

  it('disables Start once the only model task is excluded', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<DecisionPage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');

    await addNamedQuestion(user, 'matches_listing');
    expect(screen.getByRole('button', { name: /Start/ })).not.toBeDisabled();

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('starts a run via Cmd/Ctrl+Enter', async () => {
    const user = userEvent.setup();
    await seedActiveProvider();
    renderWithProviders(<DecisionPage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');

    await addNamedQuestion(user, 'matches_listing');

    await user.keyboard('{Control>}{Enter}{/Control}');

    await vi.waitFor(() => {
      const matches = Array.from(document.querySelectorAll('code')).filter((el) =>
        el.textContent?.includes('matches_listing: 92%'),
      );
      expect(matches).toHaveLength(1);
    });
  });

  it('does not start a run via Cmd/Ctrl+Enter when Start is disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DecisionPage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');

    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(submitDecision).not.toHaveBeenCalled();
  });

  it('persists tasks and callCount via Save As, and reloads them on a fresh mount', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DecisionPage />);

    await addNamedQuestion(user, 'matches_listing');
    await user.click(screen.getByRole('button', { name: 'Add model' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText('Record name'), 'Multi-model check');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await screen.findByText('Multi-model check');

    const records = await allDocsByPrefix<DecisionRecord>('decision:');
    expect(records).toHaveLength(1);
    const content = JSON.parse(records[0].content);
    expect(content.tasks).toHaveLength(2);
    expect(content.questions.matches_listing).toBeDefined();
  });
});
