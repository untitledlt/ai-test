import PouchDB from 'pouchdb-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { shouldSyncDocument } from './sync-filter';

const databases: PouchDB.Database[] = [];

function createDatabase() {
  const database = new PouchDB(`sync-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.destroy()));
});

describe('credential-free sync', () => {
  it('excludes provider IDs, types, credential-bearing documents, and provider tombstones', () => {
    expect(shouldSyncDocument({ _id: 'provider:old' })).toBe(false);
    expect(shouldSyncDocument({ _id: 'legacy', type: 'provider' })).toBe(false);
    expect(shouldSyncDocument({ _id: 'legacy', apiKey: 'test-secret' })).toBe(false);
    expect(shouldSyncDocument({ _id: 'record:deleted' })).toBe(true);
  });

  it('keeps connection settings, including credential-bearing URLs, on this device', async () => {
    const local = createDatabase();
    const remote = createDatabase();
    await local.put({ _id: 'app-settings', type: 'settings',
      syncRemoteURL: 'https://user:local-password@sync.example.test/db', syncEnabled: true });
    await remote.put({ _id: 'app-settings', type: 'settings',
      syncRemoteURL: 'https://other.example.test/db', syncEnabled: true });
    await local.sync(remote, { filter: shouldSyncDocument });
    expect(await local.get('app-settings')).toMatchObject({
      syncRemoteURL: 'https://user:local-password@sync.example.test/db',
    });
    expect(await remote.get('app-settings')).toMatchObject({
      syncRemoteURL: 'https://other.example.test/db',
    });
    expect((await local.get('app-settings', { conflicts: true }))._conflicts).toBeUndefined();
    expect((await remote.get('app-settings', { conflicts: true }))._conflicts).toBeUndefined();
    await local.remove(await local.get('app-settings'));
    await local.sync(remote, { filter: shouldSyncDocument });
    expect(await remote.get('app-settings')).toMatchObject({ type: 'settings' });
  });

  it('rejects local settings and credentials even under a record ID', () => {
    expect(shouldSyncDocument({ _id: 'app-settings' })).toBe(false);
    expect(shouldSyncDocument({ _id: 'record:settings', type: 'settings' })).toBe(false);
    expect(shouldSyncDocument({ _id: 'record:key', apiKey: 'secret' })).toBe(false);
    expect(shouldSyncDocument({ _id: 'record:url', syncRemoteURL: 'https://user:password@example.test/db' })).toBe(false);
  });

  it('syncs records both ways without copying or overwriting provider credentials', async () => {
    const local = createDatabase();
    const remote = createDatabase();
    await local.bulkDocs([
      { _id: 'provider:local', type: 'provider', apiKey: 'local-secret' },
      { _id: 'record:local', type: 'record', content: 'local prompt' },
    ]);
    await remote.bulkDocs([
      { _id: 'provider:remote', type: 'provider', apiKey: 'remote-secret' },
      { _id: 'provider:local', type: 'provider', apiKey: 'previously-synced-secret' },
      { _id: 'record:remote', type: 'record', content: 'remote prompt' },
    ]);

    await local.sync(remote, { filter: shouldSyncDocument });

    expect(await remote.get('record:local')).toMatchObject({ content: 'local prompt' });
    expect(await local.get('record:remote')).toMatchObject({ content: 'remote prompt' });
    await expect(local.get('provider:remote')).rejects.toMatchObject({ status: 404 });
    expect(await local.get('provider:local')).toMatchObject({ apiKey: 'local-secret' });
    expect(await remote.get('provider:local')).toMatchObject({ apiKey: 'previously-synced-secret' });

    // Later edits and deletion tombstones must obey the same boundary.
    const provider = await local.get('provider:local');
    await local.put({ ...provider, apiKey: 'changed-local-secret' });
    await local.sync(remote, { filter: shouldSyncDocument });
    expect(await remote.get('provider:local')).toMatchObject({ apiKey: 'previously-synced-secret' });
    await local.remove(await local.get('provider:local'));
    await local.remove(await local.get('record:local'));
    await local.sync(remote, { filter: shouldSyncDocument });
    expect(await remote.get('provider:local')).toMatchObject({ apiKey: 'previously-synced-secret' });
    await expect(remote.get('record:local')).rejects.toMatchObject({ status: 404 });
  });

  it('does not upload a new provider or an unexpected credential-bearing document', async () => {
    const local = createDatabase();
    const remote = createDatabase();
    await local.bulkDocs([
      { _id: 'provider:new', type: 'provider', apiKey: 'test-secret' },
      { _id: 'unexpected', apiKey: 'test-secret' },
      { _id: 'model:test', type: 'model', value: 'example/model' },
    ]);
    await local.sync(remote, { filter: shouldSyncDocument });
    expect((await remote.allDocs()).rows.map((row) => row.id)).toEqual(['model:test']);
  });
});
