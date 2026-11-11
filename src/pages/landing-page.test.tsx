import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { LandingPage } from './landing-page';
import * as database from '../db/client';
import type { ProviderProfile } from '../db/types';
import { getOrCreateAppSettings } from '../hooks/use-providers';
import { DEMO_URL, OPENROUTER_URL } from '../lib/onboarding';
import { seedInitialData } from '../lib/seed-data';

function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

async function renderLanding() {
  renderWithProviders(<><LandingPage /><Location /></>);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Chat & prompt testing' })).toHaveAttribute('aria-disabled', 'false'));
  return userEvent.setup();
}

async function configureProvider(serverURL: string, apiKey: string) {
  const now = new Date().toISOString();
  const provider = await database.putDoc<ProviderProfile>({
    _id: 'provider:test', type: 'provider', label: 'Existing provider', serverURL, apiKey,
    createdAt: now, updatedAt: now,
  });
  await database.putDoc({ ...await getOrCreateAppSettings(), activeProviderId: provider._id });
  return provider;
}

afterEach(() => vi.restoreAllMocks());

describe('landing page onboarding', () => {
  it.each(['Chat & prompt testing', 'Structured decisions', 'Image generation', 'Structured extraction'])(
    'gates %s and allows cancelling without changing providers', async (name) => {
      const user = await renderLanding();
      await user.click(screen.getByRole('link', { name }));
      expect(screen.getByRole('dialog')).toHaveTextContent(name);
      expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await database.allDocsByPrefix('provider:')).toHaveLength(0);
    },
  );

  it('saves a trimmed key locally, selects OpenRouter and opens the selected tool', async () => {
    const user = await renderLanding();
    await user.click(screen.getByRole('link', { name: 'Structured extraction' }));
    const save = screen.getByRole('button', { name: 'Save key and continue' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('OpenRouter API key'), '   ');
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('OpenRouter API key'), 'test-personal-key  ');
    await user.click(save);
    await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/extract'));
    const settings = await getOrCreateAppSettings();
    expect(settings.syncEnabled).toBe(false);
    expect(await database.getDoc(settings.activeProviderId!)).toMatchObject({
      serverURL: OPENROUTER_URL, apiKey: 'test-personal-key',
    });
    expect(await database.allDocsByPrefix('provider:')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects demo with a separate dummy credential, preserving personal keys and sync settings', async () => {
    const personal = await configureProvider(OPENROUTER_URL, 'private-key');
    await database.putDoc({ ...await getOrCreateAppSettings(), activeProviderId: null,
      syncEnabled: true, syncRemoteURL: 'https://couch.example/db' });
    const user = await renderLanding();
    await user.click(screen.getByRole('link', { name: 'Image generation' }));
    await user.type(screen.getByLabelText('OpenRouter API key'), 'another-private-key');
    await user.click(screen.getByRole('button', { name: 'Continue with demo' }));
    await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/image'));
    const settings = await getOrCreateAppSettings();
    expect(settings).toMatchObject({ syncEnabled: true, syncRemoteURL: 'https://couch.example/db' });
    expect(await database.getDoc(settings.activeProviderId!)).toMatchObject({
      serverURL: DEMO_URL, apiKey: expect.stringMatching(/^demo-/),
    });
    expect(await database.getDoc(personal._id)).toEqual(personal);
  });

  it.each([OPENROUTER_URL, `${OPENROUTER_URL}/`, DEMO_URL])(
    'skips onboarding with a persisted active provider at %s', async (url) => {
      await configureProvider(url, 'configured-key');
      const user = await renderLanding();
      await user.click(screen.getByRole('link', { name: 'Structured decisions' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/decision');
    },
  );

  it.each([
    [OPENROUTER_URL, '  '],
    ['https://openrouter.ai.evil.example/api/v1', 'key'],
    ['https://custom.example/v1', 'key'],
  ])('requires onboarding for an unconfigured or different provider (%s)', async (url, key) => {
    await configureProvider(url, key);
    const user = await renderLanding();
    await user.click(screen.getByRole('link', { name: 'Chat & prompt testing' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('explains opt-in sync in an expandable disclosure', async () => {
    const user = await renderLanding();
    await user.click(screen.getByRole('link', { name: 'Chat & prompt testing' }));
    const summary = screen.getByText('About data sync option');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    await user.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(screen.getByText('No data sync or backup is enabled by default.')).toBeVisible();
  });

  it('stays on the landing page on a storage failure and allows retrying', async () => {
    await seedInitialData();
    const user = await renderLanding();
    await user.click(screen.getByRole('link', { name: 'Chat & prompt testing' }));
    vi.spyOn(database, 'putDoc').mockRejectedValueOnce(new Error('storage unavailable'));
    await user.click(screen.getByRole('button', { name: 'Continue with demo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
    await user.click(screen.getByRole('button', { name: 'Continue with demo' }));
    await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/agent'));
  });
});

it('loads examples without onboarding, provider changes or generation', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const user = await renderLanding();
  expect(screen.getAllByRole('button', { name: /^Load example:/ })).toHaveLength(8);
  await user.click(screen.getByRole('button', { name: 'Load example: Extract a receipt' }));
  await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/extract\/extract/));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await database.allDocsByPrefix('provider:')).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});
