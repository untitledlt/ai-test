import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { db, putDoc } from '../db/client';
import { shouldSyncDocument } from '../db/sync-filter';
import { APP_SETTINGS_KEY, getOrCreateAppSettings, useAppSettings } from './use-providers';
import type { AppSettings } from '../db/types';

let syncHandle: ReturnType<typeof db.sync> | null = null;

function stopSync(): void {
  syncHandle?.cancel();
  syncHandle = null;
}

function startSync(remoteURL: string): void {
  stopSync();
  syncHandle = db
    .sync(remoteURL, { live: true, retry: true, filter: shouldSyncDocument })
    .on('error', (err) => {
      toast.error(`Sync error: ${err instanceof Error ? err.message : String(err)}`);
    })
    .on('denied', (err) => {
      toast.error(`Sync denied: ${err instanceof Error ? err.message : String(err)}`);
    });
}

export function ensureSyncMatchesSettings(settings: AppSettings): void {
  if (settings.syncEnabled && settings.syncRemoteURL) {
    startSync(settings.syncRemoteURL);
  } else {
    stopSync();
  }
}

export function useSyncSettings() {
  return useAppSettings();
}

export function useUpdateSyncSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { syncRemoteURL?: string; syncEnabled?: boolean }) => {
      const settings = await getOrCreateAppSettings();
      const saved = await putDoc<AppSettings>({ ...settings, ...input });
      ensureSyncMatchesSettings(saved);
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
    },
  });
}
