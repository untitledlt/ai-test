import type { ProviderProfile } from '../db/types';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
export const DEMO_URL = 'https://g1.lt/home/api/v1/ai-test/';

export function isProviderURL(value: string, expected: string): boolean {
  return value.replace(/\/+$/, '') === expected.replace(/\/+$/, '');
}

export function isDemoMode(provider: Pick<ProviderProfile, 'serverURL'> | null | undefined): boolean {
  return Boolean(provider && isProviderURL(provider.serverURL, DEMO_URL));
}

export function isOnboardingComplete(provider: ProviderProfile | null): boolean {
  return Boolean(provider?.apiKey.trim() && (
    isProviderURL(provider.serverURL, OPENROUTER_URL) ||
    isProviderURL(provider.serverURL, DEMO_URL)
  ));
}
