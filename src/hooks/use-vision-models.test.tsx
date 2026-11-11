import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { ProviderProfile } from '../db/types';

vi.mock('../lib/openrouter-client', () => ({
  listVisionModelOptions: vi.fn(),
}));

import { useVisionModelOptions } from './use-vision-models';
import { listVisionModelOptions } from '../lib/openrouter-client';

afterEach(() => {
  vi.clearAllMocks();
});

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

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useVisionModelOptions', () => {
  it('fetches vision model options for the active provider and exposes them by id', async () => {
    const provider = await seedActiveProvider();
    vi.mocked(listVisionModelOptions).mockResolvedValueOnce([
      { id: 'openai/gpt-5-image', promptPrice: 0.000002, completionPrice: 0.00001 },
    ]);

    const { result } = renderHook(() => useVisionModelOptions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listVisionModelOptions).toHaveBeenCalledWith({
      serverURL: provider.serverURL,
      apiKey: provider.apiKey,
    });
    expect(result.current.optionsById.get('openai/gpt-5-image')).toEqual({
      id: 'openai/gpt-5-image',
      promptPrice: 0.000002,
      completionPrice: 0.00001,
    });
  });

  it('does not fetch when there is no active provider', async () => {
    const { result } = renderHook(() => useVisionModelOptions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listVisionModelOptions).not.toHaveBeenCalled();
    expect(result.current.optionsById.size).toBe(0);
  });
});
