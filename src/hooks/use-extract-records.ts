import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allDocsByPrefix, getDoc, putDoc, removeDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { ExtractRecord } from '../db/types';

const EXTRACT_RECORDS_KEY = ['extract-records'] as const;

function extractRecordKey(id: string) {
  return ['extract-records', id] as const;
}

export function useExtractRecords() {
  return useQuery({
    queryKey: EXTRACT_RECORDS_KEY,
    queryFn: async () => {
      const records = await allDocsByPrefix<ExtractRecord>('extract:');
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  });
}

export function useExtractRecord(id: string | undefined) {
  return useQuery({
    queryKey: extractRecordKey(id ?? ''),
    queryFn: () => getDoc<ExtractRecord>(id ?? ''),
    enabled: id != null,
  });
}

type CreateExtractRecordInput = Pick<ExtractRecord, 'name' | 'content'>;

export function useCreateExtractRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExtractRecordInput) => {
      const now = new Date().toISOString();
      const doc: ExtractRecord = {
        _id: `extract:${randomUUID()}`,
        type: 'extract',
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      return putDoc(doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXTRACT_RECORDS_KEY });
    },
  });
}

export function useUpdateExtractRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: ExtractRecord) => {
      return putDoc<ExtractRecord>({ ...record, updatedAt: new Date().toISOString() });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: EXTRACT_RECORDS_KEY });
      queryClient.setQueryData(extractRecordKey(updated._id), updated);
    },
  });
}

export function useDeleteExtractRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: Pick<ExtractRecord, '_id' | '_rev'>) => {
      await removeDoc(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXTRACT_RECORDS_KEY });
    },
  });
}
