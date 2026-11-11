import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { ProviderProfile } from '../db/types';

vi.mock('../lib/openrouter-client', () => ({
  listImageModelOptions: vi.fn(),
  getCheapestImageOutputPrice: vi.fn(),
}));

import { useImageModelOptions, useImageModelPrices } from './use-image-models';
import { getCheapestImageOutputPrice, listImageModelOptions } from '../lib/openrouter-client';

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

describe('useImageModelOptions', () => {
  it('fetches image model options for the active provider and exposes them by id', async () => {
    const provider = await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'google/gemini-image', aspectRatios: ['1:1', '16:9'], resolutions: ['1K', '2K'], supportsImageInput: true },
    ]);

    const { result } = renderHook(() => useImageModelOptions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listImageModelOptions).toHaveBeenCalledWith({
      serverURL: provider.serverURL,
      apiKey: provider.apiKey,
    });
    expect(result.current.optionsById.get('google/gemini-image')).toEqual({
      id: 'google/gemini-image',
      aspectRatios: ['1:1', '16:9'],
      resolutions: ['1K', '2K'],
      supportsImageInput: true,
    });
  });

  it('does not fetch when there is no active provider', async () => {
    const { result } = renderHook(() => useImageModelOptions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listImageModelOptions).not.toHaveBeenCalled();
    expect(result.current.optionsById.size).toBe(0);
  });
});

describe('useImageModelPrices', () => {
  it('fetches the cheapest price for each listed model and exposes it by id', async () => {
    const provider = await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'google/gemini-image', aspectRatios: [], resolutions: [], supportsImageInput: true },
      { id: 'openai/gpt-image', aspectRatios: [], resolutions: [], supportsImageInput: true },
    ]);
    vi.mocked(getCheapestImageOutputPrice).mockImplementation(async ({ modelId }) =>
      modelId === 'google/gemini-image' ? { costUsd: 0.02, unit: 'image' } : { costUsd: 0.1, unit: 'megapixel' },
    );

    const { result } = renderHook(() => useImageModelPrices(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getCheapestImageOutputPrice).toHaveBeenCalledWith({
      serverURL: provider.serverURL,
      apiKey: provider.apiKey,
      modelId: 'google/gemini-image',
    });
    expect(result.current.priceById.get('google/gemini-image')).toEqual({ costUsd: 0.02, unit: 'image' });
    expect(result.current.priceById.get('openai/gpt-image')).toEqual({ costUsd: 0.1, unit: 'megapixel' });
  });

  it('omits a model from the map when its price lookup fails', async () => {
    await seedActiveProvider();
    vi.mocked(listImageModelOptions).mockResolvedValueOnce([
      { id: 'broken/model', aspectRatios: [], resolutions: [], supportsImageInput: true },
    ]);
    vi.mocked(getCheapestImageOutputPrice).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useImageModelPrices(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.priceById.has('broken/model')).toBe(false);
  });
});
