import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allDocsByPrefix, getDoc, putDoc, removeDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { ImageGenRecord } from '../db/types';

const IMAGE_GEN_RECORDS_KEY = ['image-gen-records'] as const;

function imageGenRecordKey(id: string) {
  return ['image-gen-records', id] as const;
}

export function useImageGenRecords() {
  return useQuery({
    queryKey: IMAGE_GEN_RECORDS_KEY,
    queryFn: async () => {
      const records = await allDocsByPrefix<ImageGenRecord>('image-gen:');
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  });
}

export function useImageGenRecord(id: string | undefined) {
  return useQuery({
    queryKey: imageGenRecordKey(id ?? ''),
    queryFn: () => getDoc<ImageGenRecord>(id ?? ''),
    enabled: id != null,
  });
}

type CreateImageGenRecordInput = Pick<ImageGenRecord, 'name' | 'content'>;

export function useCreateImageGenRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateImageGenRecordInput) => {
      const now = new Date().toISOString();
      const doc: ImageGenRecord = {
        _id: `image-gen:${randomUUID()}`,
        type: 'image-gen',
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      return putDoc(doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IMAGE_GEN_RECORDS_KEY });
    },
  });
}

export function useUpdateImageGenRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: ImageGenRecord) => {
      return putDoc<ImageGenRecord>({ ...record, updatedAt: new Date().toISOString() });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: IMAGE_GEN_RECORDS_KEY });
      queryClient.setQueryData(imageGenRecordKey(updated._id), updated);
    },
  });
}

export function useDeleteImageGenRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: Pick<ImageGenRecord, '_id' | '_rev'>) => {
      await removeDoc(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IMAGE_GEN_RECORDS_KEY });
    },
  });
}
