import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActiveProvider } from './use-providers';
import { useDecisionModelOptions } from './use-decision-models';
import { useChatModelOptions } from './use-chat-models';
import { useVisionModelOptions } from './use-vision-models';
import { useImageModelOptions } from './use-image-models';
import { listDecisionModelOptions, listChatModelOptions, listVisionModelOptions, listImageModelOptions } from '../lib/openrouter-client';
import type { ProviderProfile } from '../db/types';

vi.mock('./use-providers', () => ({ useActiveProvider: vi.fn() }));
vi.mock('../lib/openrouter-client', () => ({
  listDecisionModelOptions: vi.fn(),
  listChatModelOptions: vi.fn(),
  listVisionModelOptions: vi.fn(),
  listImageModelOptions: vi.fn(),
  getCheapestImageOutputPrice: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

const provider: ProviderProfile = {
  _id: 'provider:test', _rev: '1-test', type: 'provider', label: 'Test',
  serverURL: 'https://example.test/v1', apiKey: 'test-key', createdAt: '', updatedAt: '',
};

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe.each([
  { name: 'decisions', useOptions: useDecisionModelOptions, fetchOptions: listDecisionModelOptions },
  { name: 'chat', useOptions: useChatModelOptions, fetchOptions: listChatModelOptions },
  { name: 'vision', useOptions: useVisionModelOptions, fetchOptions: listVisionModelOptions },
  { name: 'image', useOptions: useImageModelOptions, fetchOptions: listImageModelOptions },
])('$name model discovery', ({ useOptions, fetchOptions }) => {
  it('does not contact an unconfigured provider', () => {
    vi.mocked(useActiveProvider).mockReturnValue({ activeProvider: { ...provider, apiKey: '' }, isLoading: false });
    const { result } = renderHook(() => useOptions(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(fetchOptions).not.toHaveBeenCalled();
  });

  it('refetches after the active provider URL or credentials are edited', async () => {
    vi.mocked(fetchOptions).mockResolvedValue([]);
    vi.mocked(useActiveProvider).mockReturnValue({ activeProvider: provider, isLoading: false });
    const { rerender } = renderHook(() => useOptions(), { wrapper: createWrapper() });
    await waitFor(() => expect(fetchOptions).toHaveBeenCalledTimes(1));

    const edited = { ...provider, _rev: '2-test', serverURL: 'https://new.example.test/v1', apiKey: 'new-key' };
    vi.mocked(useActiveProvider).mockReturnValue({ activeProvider: edited, isLoading: false });
    rerender();
    await waitFor(() => expect(fetchOptions).toHaveBeenCalledTimes(2));
    expect(fetchOptions).toHaveBeenLastCalledWith({ serverURL: edited.serverURL, apiKey: edited.apiKey });
  });
});
