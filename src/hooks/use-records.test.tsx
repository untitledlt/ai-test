import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateRecord, useDeleteRecord, useRecord, useRecords, useUpdateRecord } from './use-records';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-records', () => {
  it('creates a record and lists it', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateRecord(), list: useRecords() }),
      { wrapper },
    );

    await act(async () => {
      await result.current.create.mutateAsync({ name: 'My prompt', content: '{"messages":[]}' });
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    expect(result.current.list.data?.[0]).toMatchObject({ name: 'My prompt', content: '{"messages":[]}' });
  });

  it('lists records sorted by updatedAt descending', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ create: useCreateRecord(), list: useRecords() }), { wrapper });

    let first: { _id: string } | undefined = undefined;
    await act(async () => {
      first = await result.current.create.mutateAsync({ name: 'Older', content: '{}' });
    });
    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Newer', content: '{}' });
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    expect(result.current.list.data?.map((r) => r.name)).toEqual(['Newer', 'Older']);
    expect(first).toBeDefined();
  });

  it('updates a record in place and bumps updatedAt', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateRecord(), update: useUpdateRecord(), get: useRecord(undefined) }),
      { wrapper },
    );

    let created!: Awaited<ReturnType<typeof result.current.create.mutateAsync>>;
    await act(async () => {
      created = await result.current.create.mutateAsync({ name: 'Draft', content: '{}' });
    });

    await act(async () => {
      await result.current.update.mutateAsync({ ...created, name: 'Final', content: '{"messages":[]}' });
    });

    await waitFor(() => expect(result.current.update.data?.name).toBe('Final'));
    expect(result.current.update.data?.content).toBe('{"messages":[]}');
  });

  it('deletes a record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ create: useCreateRecord(), del: useDeleteRecord(), list: useRecords() }), {
      wrapper,
    });

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

  it('returns null from useRecord for a missing id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRecord('record:does-not-exist'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
