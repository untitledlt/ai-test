import { useQuery } from '@tanstack/react-query';
import { useActiveProvider } from './use-providers';
import { listDecisionModelOptions, type ChatModelOptions } from '../lib/openrouter-client';

export function useDecisionModelOptions() {
  const { activeProvider, isLoading: isProviderLoading } = useActiveProvider();

  const query = useQuery({
    queryKey: ['decision-model-options', activeProvider?._id, activeProvider?._rev],
    queryFn: () => listDecisionModelOptions({ serverURL: activeProvider!.serverURL, apiKey: activeProvider!.apiKey }),
    enabled: Boolean(activeProvider?.apiKey.trim()),
    staleTime: 5 * 60 * 1000,
  });

  const optionsById = new Map<string, ChatModelOptions>((query.data ?? []).map((option) => [option.id, option]));

  return { optionsById, isLoading: isProviderLoading || (activeProvider != null && query.isLoading) };
}
