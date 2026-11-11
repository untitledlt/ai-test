import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allDocsByPrefix, getDoc, putDoc, removeDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { DecisionRecord } from '../db/types';

const DECISION_RECORDS_KEY = ['decision-records'] as const;

function decisionRecordKey(id: string) {
  return ['decision-records', id] as const;
}

export function useDecisionRecords() {
  return useQuery({
    queryKey: DECISION_RECORDS_KEY,
    queryFn: async () => {
      const records = await allDocsByPrefix<DecisionRecord>('decision:');
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  });
}

export function useDecisionRecord(id: string | undefined) {
  return useQuery({
    queryKey: decisionRecordKey(id ?? ''),
    queryFn: () => getDoc<DecisionRecord>(id ?? ''),
    enabled: id != null,
  });
}

type CreateDecisionRecordInput = Pick<DecisionRecord, 'name' | 'content'>;

export function useCreateDecisionRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDecisionRecordInput) => {
      const now = new Date().toISOString();
      const doc: DecisionRecord = {
        _id: `decision:${randomUUID()}`,
        type: 'decision',
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      return putDoc(doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECISION_RECORDS_KEY });
    },
  });
}

export function useUpdateDecisionRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: DecisionRecord) => {
      return putDoc<DecisionRecord>({ ...record, updatedAt: new Date().toISOString() });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: DECISION_RECORDS_KEY });
      queryClient.setQueryData(decisionRecordKey(updated._id), updated);
    },
  });
}

export function useDeleteDecisionRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: Pick<DecisionRecord, '_id' | '_rev'>) => {
      await removeDoc(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECISION_RECORDS_KEY });
    },
  });
}
