import { useQuery } from '@tanstack/react-query';
import { useActiveProvider } from './use-providers';
import {
  getCheapestImageOutputPrice,
  listImageModelOptions,
  type ImageModelOptions,
  type ImageModelPrice,
} from '../lib/openrouter-client';

export function useImageModelOptions() {
  const { activeProvider, isLoading: isProviderLoading } = useActiveProvider();

  const query = useQuery({
    queryKey: ['image-model-options', activeProvider?._id, activeProvider?._rev],
    queryFn: () => listImageModelOptions({ serverURL: activeProvider!.serverURL, apiKey: activeProvider!.apiKey }),
    enabled: Boolean(activeProvider?.apiKey.trim()),
    staleTime: 5 * 60 * 1000,
  });

  const optionsById = new Map<string, ImageModelOptions>((query.data ?? []).map((option) => [option.id, option]));

  return { optionsById, isLoading: isProviderLoading || (activeProvider != null && query.isLoading) };
}

export function useImageModelPrices() {
  const { activeProvider, isLoading: isProviderLoading } = useActiveProvider();
  const { optionsById, isLoading: isOptionsLoading } = useImageModelOptions();
  const modelIds = Array.from(optionsById.keys());

  const query = useQuery({
    queryKey: ['image-model-prices', activeProvider?._id, activeProvider?._rev, modelIds],
    queryFn: async () => {
      const entries = await Promise.all(
        modelIds.map(async (modelId): Promise<[string, ImageModelPrice] | null> => {
          try {
            const price = await getCheapestImageOutputPrice({
              serverURL: activeProvider!.serverURL,
              apiKey: activeProvider!.apiKey,
              modelId,
            });
            return price ? [modelId, price] : null;
          } catch {
            return null;
          }
        }),
      );
      return new Map(entries.filter((entry): entry is [string, ImageModelPrice] => entry != null));
    },
    enabled: Boolean(activeProvider?.apiKey.trim()) && modelIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    priceById: query.data ?? new Map<string, ImageModelPrice>(),
    isLoading: isProviderLoading || isOptionsLoading || (modelIds.length > 0 && query.isLoading),
  };
}
