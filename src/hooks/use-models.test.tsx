import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAddCustomModel, useCustomModels, useDeleteCustomModel } from './use-models';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-models', () => {
  it('adds a custom model and lists it', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ add: useAddCustomModel(), list: useCustomModels() }), { wrapper });

    await act(async () => {
      await result.current.add.mutateAsync('my/custom-model');
    });

    await waitFor(() => expect(result.current.list.data?.some((m) => m.value === 'my/custom-model')).toBe(true));
  });

  it('does not create a duplicate when the same value is added twice', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ add: useAddCustomModel(), list: useCustomModels() }), { wrapper });

    await act(async () => {
      await result.current.add.mutateAsync('my/custom-model');
    });
    await act(async () => {
      await result.current.add.mutateAsync('my/custom-model');
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
  });

  it('ignores blank input', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ add: useAddCustomModel(), list: useCustomModels() }), { wrapper });

    await act(async () => {
      await result.current.add.mutateAsync('   ');
    });

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(result.current.list.data).toHaveLength(0);
  });

  it('removes a custom model', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ add: useAddCustomModel(), del: useDeleteCustomModel(), list: useCustomModels() }),
      { wrapper },
    );

    let saved!: Awaited<ReturnType<typeof result.current.add.mutateAsync>>;
    await act(async () => {
      saved = await result.current.add.mutateAsync('my/custom-model');
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    await act(async () => {
      await result.current.del.mutateAsync(saved!);
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(0));
  });
});
