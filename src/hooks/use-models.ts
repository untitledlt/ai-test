import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allDocsByPrefix, putDoc, removeDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { CustomModel } from '../db/types';

const CUSTOM_MODELS_KEY = ['custom-models'] as const;

export function useCustomModels() {
  return useQuery({
    queryKey: CUSTOM_MODELS_KEY,
    queryFn: async () => {
      const models = await allDocsByPrefix<CustomModel>('model:');
      return models.sort((a, b) => a.value.localeCompare(b.value));
    },
  });
}

export function useAddCustomModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const existing = await allDocsByPrefix<CustomModel>('model:');
      const match = existing.find((model) => model.value === trimmed);
      if (match) return match;
      const doc: CustomModel = {
        _id: `model:${randomUUID()}`,
        type: 'model',
        value: trimmed,
        createdAt: new Date().toISOString(),
      };
      return putDoc(doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_MODELS_KEY });
    },
  });
}

export function useDeleteCustomModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (model: Pick<CustomModel, '_id' | '_rev'>) => {
      await removeDoc(model);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_MODELS_KEY });
    },
  });
}
