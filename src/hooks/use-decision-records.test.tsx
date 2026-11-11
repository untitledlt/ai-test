import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateDecisionRecord,
  useDecisionRecord,
  useDecisionRecords,
  useDeleteDecisionRecord,
  useUpdateDecisionRecord,
} from './use-decision-records';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-decision-records', () => {
  it('creates a decision record and lists it', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateDecisionRecord(), list: useDecisionRecords() }),
      { wrapper },
    );

    await act(async () => {
      await result.current.create.mutateAsync({ name: 'My decision', content: '{"state":[],"questions":{}}' });
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    expect(result.current.list.data?.[0]).toMatchObject({ name: 'My decision', content: '{"state":[],"questions":{}}' });
  });

  it('lists decision records sorted by updatedAt descending', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ create: useCreateDecisionRecord(), list: useDecisionRecords() }), { wrapper });

    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Older', content: '{}' });
    });
    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Newer', content: '{}' });
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    expect(result.current.list.data?.map((r) => r.name)).toEqual(['Newer', 'Older']);
  });

  it('updates a decision record in place and bumps updatedAt', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateDecisionRecord(), update: useUpdateDecisionRecord() }),
      { wrapper },
    );

    let created!: Awaited<ReturnType<typeof result.current.create.mutateAsync>>;
    await act(async () => {
      created = await result.current.create.mutateAsync({ name: 'Draft', content: '{}' });
    });

    await act(async () => {
      await result.current.update.mutateAsync({ ...created, name: 'Final', content: '{"state":["x"],"questions":{}}' });
    });

    await waitFor(() => expect(result.current.update.data?.name).toBe('Final'));
    expect(result.current.update.data?.content).toBe('{"state":["x"],"questions":{}}');
  });

  it('deletes a decision record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ create: useCreateDecisionRecord(), del: useDeleteDecisionRecord(), list: useDecisionRecords() }),
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

  it('returns null from useDecisionRecord for a missing id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDecisionRecord('decision:does-not-exist'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
