import { beforeEach, describe, expect, it } from 'vitest';
import { allDocsByPrefix, putDoc } from '../db/client';
import { getOrCreateAppSettings } from '../hooks/use-providers';
import { seedInitialData } from './seed-data';
import type { AgentRecord, ProviderProfile } from '../db/types';

const MODEL_STORAGE_KEY = 'ai-test-agent:last-model';

describe('seedInitialData', () => {
  beforeEach(() => {
    localStorage.removeItem(MODEL_STORAGE_KEY);
  });

  it('seeds an active OpenRouter provider without credentials and the sample record', async () => {
    await seedInitialData();

    const providers = await allDocsByPrefix<ProviderProfile>('provider:');
    expect(providers).toHaveLength(1);

    const openRouterProvider = providers.find((p) => p.label === 'OpenRouter');
    expect(openRouterProvider).toMatchObject({
      serverURL: 'https://openrouter.ai/api/v1',
      apiKey: '',
    });

    const settings = await getOrCreateAppSettings();
    expect(settings.activeProviderId).toBe(openRouterProvider?._id);

    const records = await allDocsByPrefix<AgentRecord>('record:');
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('prison');
    const parsed = JSON.parse(records[0].content);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.tools[0].function.name).toBe('unlock_door');

    expect(localStorage.getItem(MODEL_STORAGE_KEY)).toBe('google/gemini-3.1-flash-lite');
  });

  it('does nothing if a provider already exists', async () => {
    const now = new Date().toISOString();
    await putDoc<ProviderProfile>({
      _id: `provider:${crypto.randomUUID()}`,
      type: 'provider',
      label: 'Existing',
      serverURL: 'https://example.com',
      apiKey: '',
      createdAt: now,
      updatedAt: now,
    });

    await seedInitialData();

    const providers = await allDocsByPrefix<ProviderProfile>('provider:');
    expect(providers).toHaveLength(1);
    expect(providers[0].label).toBe('Existing');

    const records = await allDocsByPrefix<AgentRecord>('record:');
    expect(records).toHaveLength(0);
  });

  it('does nothing if a record already exists', async () => {
    const now = new Date().toISOString();
    await putDoc<AgentRecord>({
      _id: `record:${crypto.randomUUID()}`,
      type: 'record',
      name: 'Existing',
      content: '{"messages":[]}',
      createdAt: now,
      updatedAt: now,
    });

    await seedInitialData();

    const providers = await allDocsByPrefix<ProviderProfile>('provider:');
    expect(providers).toHaveLength(0);

    const records = await allDocsByPrefix<AgentRecord>('record:');
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Existing');
  });

  it('only seeds once even if called multiple times', async () => {
    await seedInitialData();
    await seedInitialData();

    const providers = await allDocsByPrefix<ProviderProfile>('provider:');
    expect(providers).toHaveLength(1);
  });

  it('does not duplicate seed data when startup runs concurrently', async () => {
    await Promise.all([seedInitialData(), seedInitialData()]);
    expect(await allDocsByPrefix('provider:')).toHaveLength(1);
    expect(await allDocsByPrefix('record:')).toHaveLength(1);
  });
});
