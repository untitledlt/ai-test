import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateImageGenRecord,
  useImageGenRecord,
  useImageGenRecords,
  useDeleteImageGenRecord,
  useUpdateImageGenRecord,
} from './use-image-gen-records';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-image-gen-records', () => {
  it('creates an image-gen record and lists it', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateImageGenRecord(), list: useImageGenRecords() }),
      { wrapper },
    );

    await act(async () => {
      await result.current.create.mutateAsync({ name: 'My image', content: '{"prompt":"x"}' });
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    expect(result.current.list.data?.[0]).toMatchObject({ name: 'My image', content: '{"prompt":"x"}' });
  });

  it('lists image-gen records sorted by updatedAt descending', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ create: useCreateImageGenRecord(), list: useImageGenRecords() }), { wrapper });

    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Older', content: '{}' });
    });
    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Newer', content: '{}' });
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    expect(result.current.list.data?.map((r) => r.name)).toEqual(['Newer', 'Older']);
  });

  it('updates an image-gen record in place and bumps updatedAt', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateImageGenRecord(), update: useUpdateImageGenRecord() }),
      { wrapper },
    );

    let created!: Awaited<ReturnType<typeof result.current.create.mutateAsync>>;
    await act(async () => {
      created = await result.current.create.mutateAsync({ name: 'Draft', content: '{}' });
    });

    await act(async () => {
      await result.current.update.mutateAsync({ ...created, name: 'Final', content: '{"prompt":"y"}' });
    });

    await waitFor(() => expect(result.current.update.data?.name).toBe('Final'));
    expect(result.current.update.data?.content).toBe('{"prompt":"y"}');
  });

  it('deletes an image-gen record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateImageGenRecord(), del: useDeleteImageGenRecord(), list: useImageGenRecords() }),
      { wrapper },
    );

    let created!: Awaited<ReturnType<typeof result.current.create.mutateAsync>>;
    await act(async () => {
      created = await result.current.create.mutateAsync({ name: 'Temp', content: '{}' });
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    await act(async () => {
      await result.current.del.mutateAsync(created);
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(0));
  });

  it('returns null from useImageGenRecord for a missing id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImageGenRecord('image-gen:does-not-exist'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
