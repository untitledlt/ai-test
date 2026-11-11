import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allDocsByPrefix, getDoc, putDoc, removeDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { AppSettings, ProviderProfile } from '../db/types';

const PROVIDERS_KEY = ['providers'] as const;
export const APP_SETTINGS_KEY = ['app-settings'] as const;

export async function getOrCreateAppSettings(): Promise<AppSettings> {
  const existing = await getDoc<AppSettings>('app-settings');
  if (existing) return existing;
  const defaults: AppSettings = {
    _id: 'app-settings',
    type: 'settings',
    activeProviderId: null,
    syncEnabled: false,
  };
  try {
    return await putDoc(defaults);
  } catch (err) {
    // Startup and mounted queries can create this singleton concurrently.
    if (typeof err === 'object' && err !== null && 'status' in err && err.status === 409) {
      const created = await getDoc<AppSettings>('app-settings');
      if (created) return created;
    }
    throw err;
  }
}

export function useProviders() {
  return useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: () => allDocsByPrefix<ProviderProfile>('provider:'),
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: APP_SETTINGS_KEY,
    queryFn: getOrCreateAppSettings,
  });
}

export function useActiveProvider() {
  const settingsQuery = useAppSettings();
  const providersQuery = useProviders();

  const activeProviderId = settingsQuery.data?.activeProviderId ?? null;
  const activeProvider = providersQuery.data?.find((provider) => provider._id === activeProviderId) ?? null;

  return {
    activeProvider,
    isLoading: settingsQuery.isLoading || providersQuery.isLoading,
  };
}

export function useSaveProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Pick<ProviderProfile, 'label' | 'serverURL' | 'apiKey'> & Partial<Pick<ProviderProfile, '_id' | '_rev'>>,
    ) => {
      const now = new Date().toISOString();
      if (input._id) {
        const existing = await getDoc<ProviderProfile>(input._id);
        if (!existing) throw new Error('Provider not found');
        return putDoc<ProviderProfile>({ ...existing, ...input, updatedAt: now });
      }
      const doc: ProviderProfile = {
        _id: `provider:${randomUUID()}`,
        type: 'provider',
        label: input.label,
        serverURL: input.serverURL,
        apiKey: input.apiKey,
        createdAt: now,
        updatedAt: now,
      };
      return putDoc(doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROVIDERS_KEY });
    },
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: Pick<ProviderProfile, '_id' | '_rev'>) => {
      await removeDoc(provider);
      const settings = await getOrCreateAppSettings();
      if (settings.activeProviderId === provider._id) {
        await putDoc<AppSettings>({ ...settings, activeProviderId: null });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROVIDERS_KEY });
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
    },
  });
}

export function useSetActiveProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const settings = await getOrCreateAppSettings();
      return putDoc<AppSettings>({ ...settings, activeProviderId: providerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
    },
  });
}
