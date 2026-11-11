import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getOrCreateAppSettings,
  useActiveProvider,
  useAppSettings,
  useDeleteProvider,
  useProviders,
  useSaveProvider,
  useSetActiveProvider,
} from './use-providers';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-providers', () => {
  it('handles concurrent first-run settings creation', async () => {
    const settings = await Promise.all([getOrCreateAppSettings(), getOrCreateAppSettings()]);
    expect(settings[0]).toEqual(settings[1]);
    expect(settings[0].activeProviderId).toBeNull();
  });
  it('starts with no providers until one is saved or seeded', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProviders(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('saves a new provider and lists it', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ save: useSaveProvider(), list: useProviders() }), { wrapper });

    await act(async () => {
      await result.current.save.mutateAsync({ label: 'Local vLLM', serverURL: 'http://localhost:8000/v1', apiKey: 'k' });
    });

    await waitFor(() => expect(result.current.list.data?.some((p) => p.label === 'Local vLLM')).toBe(true));
  });

  it('sets the active provider and useActiveProvider reflects it', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ save: useSaveProvider(), setActive: useSetActiveProvider(), active: useActiveProvider() }),
      { wrapper },
    );

    let saved!: Awaited<ReturnType<typeof result.current.save.mutateAsync>>;
    await act(async () => {
      saved = await result.current.save.mutateAsync({ label: 'Provider A', serverURL: 'https://a.example', apiKey: 'key-a' });
    });
    await act(async () => {
      await result.current.setActive.mutateAsync(saved._id);
    });

    await waitFor(() => expect(result.current.active.activeProvider?._id).toBe(saved._id));
    expect(result.current.active.activeProvider?.label).toBe('Provider A');
  });

  it('editing an existing provider updates it in place rather than creating a new one', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ save: useSaveProvider(), list: useProviders() }), { wrapper });

    let saved!: Awaited<ReturnType<typeof result.current.save.mutateAsync>>;
    await act(async () => {
      saved = await result.current.save.mutateAsync({ label: 'Original', serverURL: 'https://x.example', apiKey: '' });
    });
    await act(async () => {
      await result.current.save.mutateAsync({ _id: saved._id, _rev: saved._rev, label: 'Renamed', serverURL: 'https://x.example', apiKey: 'new-key' });
    });

    await waitFor(() => expect(result.current.list.data?.[0]?.label).toBe('Renamed'));
    expect(result.current.list.data).toHaveLength(1);
    expect(result.current.list.data?.[0]).toMatchObject({ _id: saved._id, label: 'Renamed', apiKey: 'new-key' });
  });

  it('clears activeProviderId when the active provider is deleted', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ save: useSaveProvider(), setActive: useSetActiveProvider(), del: useDeleteProvider(), settings: useAppSettings() }),
      { wrapper },
    );

    let saved!: Awaited<ReturnType<typeof result.current.save.mutateAsync>>;
    await act(async () => {
      saved = await result.current.save.mutateAsync({ label: 'ToDelete', serverURL: 'https://d.example', apiKey: '' });
    });
    await act(async () => {
      await result.current.setActive.mutateAsync(saved._id);
    });
    await waitFor(() => expect(result.current.settings.data?.activeProviderId).toBe(saved._id));

    await act(async () => {
      await result.current.del.mutateAsync(saved);
    });

    await waitFor(() => expect(result.current.settings.data?.activeProviderId).toBeNull());
  });
});
