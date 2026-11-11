import { afterEach, expect, it, vi } from 'vitest';
import { db } from '../db/client';
import { shouldSyncDocument } from '../db/sync-filter';
import { ensureSyncMatchesSettings } from './use-sync-settings';

afterEach(() => {
  ensureSyncMatchesSettings({ _id: 'app-settings', type: 'settings', activeProviderId: null, syncEnabled: false });
  vi.restoreAllMocks();
});

it('applies the credential filter to live sync and cancels it when disabled', () => {
  const handle = { on: vi.fn().mockReturnThis(), cancel: vi.fn() };
  const sync = vi.spyOn(db, 'sync').mockReturnValue(handle as unknown as ReturnType<typeof db.sync>);
  const settings = {
    _id: 'app-settings' as const, type: 'settings' as const, activeProviderId: null,
    syncEnabled: true, syncRemoteURL: 'https://sync.example.test/database',
  };
  ensureSyncMatchesSettings(settings);
  expect(sync).toHaveBeenCalledWith(settings.syncRemoteURL, {
    live: true, retry: true, filter: shouldSyncDocument,
  });
  ensureSyncMatchesSettings({ ...settings, syncEnabled: false });
  expect(handle.cancel).toHaveBeenCalledOnce();
});
