import { useMutation } from '@tanstack/react-query';
import { submitCompletion } from '../lib/openrouter-client';
import { useActiveProvider } from './use-providers';
import type { CompletionResult, Message, ReasoningEffort } from '../types';

export type CompletionInput = {
  model: string;
  messages: Message[];
  tools?: unknown[];
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
};

export function useCompletion() {
  const { activeProvider } = useActiveProvider();

  return useMutation<CompletionResult, Error, CompletionInput>({
    mutationFn: async (input) => {
      if (!activeProvider || !activeProvider.apiKey) {
        throw new Error('Configure a provider in Settings before submitting.');
      }
      return submitCompletion({
        serverURL: activeProvider.serverURL,
        apiKey: activeProvider.apiKey,
        ...input,
      });
    },
  });
}
