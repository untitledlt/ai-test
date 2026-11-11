import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { SettingsPage } from './settings-page';
import { putDoc } from '../db/client';
import type { ProviderProfile } from '../db/types';

async function seedProvider(label: string, apiKey = ''): Promise<ProviderProfile> {
  const now = new Date().toISOString();
  return putDoc<ProviderProfile>({
    _id: `provider:${crypto.randomUUID()}`,
    type: 'provider',
    label,
    serverURL: 'https://example.test/v1',
    apiKey,
    createdAt: now,
    updatedAt: now,
  });
}

describe('SettingsPage', () => {
  it('shows no providers and warns an active provider is needed when the db is empty', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('No providers configured.')).toBeInTheDocument();
    expect(screen.getByText(/Configure an active provider with an API key/)).toBeInTheDocument();
  });

  it('adds a new provider via the dialog', async () => {
    const user = userEvent.setup();
    await seedProvider('Existing');
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Existing');

    await user.click(screen.getByRole('button', { name: /Add profile/ }));
    await user.type(screen.getByPlaceholderText('OpenRouter'), 'Local vLLM');
    await user.type(screen.getByPlaceholderText('https://openrouter.ai/api/v1'), 'http://localhost:8000/v1');
    await user.type(screen.getByPlaceholderText('sk-or-...'), 'secret-key');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Local vLLM')).toBeInTheDocument();
  });

  it('deletes a provider after confirming', async () => {
    const user = userEvent.setup();
    await seedProvider('To delete');
    renderWithProviders(<SettingsPage />);
    await screen.findByText('To delete');

    const row = screen.getByText('To delete').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete provider' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('No providers configured.')).toBeInTheDocument();
  });

  it('enables the sync switch only once a remote URL is entered', async () => {
    const user = userEvent.setup();
    await seedProvider('Any');
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Any');

    const syncSwitch = screen.getByRole('switch', { name: 'Enable live sync' });
    expect(syncSwitch).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/user:pass@host/), 'https://sync.example/db');
    expect(syncSwitch).toBeEnabled();
  });
});
