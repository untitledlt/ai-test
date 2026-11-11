import { useMutation, useQueryClient } from '@tanstack/react-query';
import { allDocsByPrefix, putDoc } from '../db/client';
import type { AppSettings, ProviderProfile } from '../db/types';
import { DEMO_URL, isProviderURL, OPENROUTER_URL } from '../lib/onboarding';
import { seedInitialData } from '../lib/seed-data';
import { randomUUID } from '../lib/uuid';
import { APP_SETTINGS_KEY, getOrCreateAppSettings } from './use-providers';

export type OnboardingChoice = { mode: 'openrouter'; apiKey: string } | { mode: 'demo' };

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (choice: OnboardingChoice) => {
      if (choice.mode === 'openrouter' && !choice.apiKey.trim()) {
        throw new Error('Enter your OpenRouter API key.');
      }
      // Let first-run seeding finish before selecting a provider.
      await seedInitialData();
      const providers = await allDocsByPrefix<ProviderProfile>('provider:');
      const serverURL = choice.mode === 'demo' ? DEMO_URL : OPENROUTER_URL;
      const apiKey = choice.mode === 'demo' ? `demo-${randomUUID()}` : choice.apiKey.trim();
      const matching = providers.filter((provider) => isProviderURL(provider.serverURL, serverURL));
      // Reuse the same credentials or an empty profile, preserving other saved keys.
      const existing = matching.find((provider) => choice.mode === 'demo'
        ? provider.apiKey.startsWith('demo-')
        : provider.apiKey === apiKey) ?? matching.find((provider) => !provider.apiKey.trim());
      const now = new Date().toISOString();
      const provider = await putDoc<ProviderProfile>({
        ...existing,
        _id: existing?._id ?? `provider:${randomUUID()}`,
        type: 'provider',
        label: choice.mode === 'demo' ? 'Demo (experimental)' : 'OpenRouter',
        serverURL,
        apiKey: choice.mode === 'demo' && existing?.apiKey.startsWith('demo-') ? existing.apiKey : apiKey,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      const settings = await getOrCreateAppSettings();
      return putDoc<AppSettings>({ ...settings, activeProviderId: provider._id });
    },
    onSuccess: async (settings) => {
      queryClient.setQueryData(APP_SETTINGS_KEY, settings);
      await queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });
}
