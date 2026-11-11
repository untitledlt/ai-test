import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allDocsByPrefix, getDoc, putDoc, removeDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { AgentRecord } from '../db/types';

const RECORDS_KEY = ['records'] as const;

function recordKey(id: string) {
  return ['records', id] as const;
}

export function useRecords() {
  return useQuery({
    queryKey: RECORDS_KEY,
    queryFn: async () => {
      const records = await allDocsByPrefix<AgentRecord>('record:');
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  });
}

export function useRecord(id: string | undefined) {
  return useQuery({
    queryKey: recordKey(id ?? ''),
    queryFn: () => getDoc<AgentRecord>(id ?? ''),
    enabled: id != null,
  });
}

type CreateRecordInput = Pick<AgentRecord, 'name' | 'content'> &
  Partial<Pick<AgentRecord, 'multipleTasks' | 'multipleCallCount' | 'multipleTestSuite' | 'multipleResultsHistory'>>;

export function useCreateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRecordInput) => {
      const now = new Date().toISOString();
      const doc: AgentRecord = {
        _id: `record:${randomUUID()}`,
        type: 'record',
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      return putDoc(doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECORDS_KEY });
    },
  });
}

export function useUpdateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: AgentRecord) => {
      return putDoc<AgentRecord>({ ...record, updatedAt: new Date().toISOString() });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: RECORDS_KEY });
      queryClient.setQueryData(recordKey(updated._id), updated);
    },
  });
}

export function useDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: Pick<AgentRecord, '_id' | '_rev'>) => {
      await removeDoc(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECORDS_KEY });
    },
  });
}
