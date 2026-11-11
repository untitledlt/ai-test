import { capDemoMaxTokens } from './run-limits';
import { isDemoMode } from './onboarding';
import { OpenRouter } from '@openrouter/sdk';
// Extracts the fields OpenRouter attaches to a wrapped upstream-provider failure. The SDK's own
// `Error.message` for these is often a generic string (e.g. "Provider returned error") — the
// actual provider-side reason lives in `error.metadata`, which the SDK leaves untyped since its
// shape varies by provider.
type ProviderErrorLike = {
  statusCode?: number;
  headers?: Headers;
  body?: string;
  error?: {
    code?: number;
    message?: string;
    metadata?: {
      provider_name?: string;
      raw?: string;
    } | null;
  };
};

export function formatRequestError(err: unknown, serverURL?: string): string {
  if (!(err instanceof Error)) return String(err);
  const failure = err as Error & ProviderErrorLike;
  let message = failure.error?.message;
  // Generic SDK HTTP errors retain the JSON response as a string body.
  if (!message && failure.body) {
    try {
      const parsed = JSON.parse(failure.body);
      if (typeof parsed?.error?.message === 'string') message = parsed.error.message;
    } catch { /* Preserve the SDK message for non-JSON responses. */ }
  }
  const status = failure.statusCode ?? failure.error?.code;
  if (serverURL && isDemoMode({ serverURL }) && (status === 402 || status === 429)) {
    const retryAfter = failure.headers?.get('Retry-After');
    const seconds = retryAfter && /^\d+$/.test(retryAfter.trim())
      ? Number(retryAfter)
      : retryAfter ? (Date.parse(retryAfter) - Date.now()) / 1000 : NaN;
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    const retry = Number.isFinite(seconds) && seconds >= 0
      ? ` Retry in about ${minutes >= 60 ? `${Math.ceil(minutes / 60)} hour${minutes > 60 ? 's' : ''}` : `${minutes} minute${minutes === 1 ? '' : 's'}`}.`
      : '';
    const heading = status === 402
      ? (message && !message.includes('reached its spending limit') ? 'Demo service unavailable.' : 'Demo spending limit reached.')
      : 'Demo limit reached.';
    const fallback = status === 402
      ? 'The demo service has reached its spending limit. Please try again later.'
      : 'The demo service is temporarily rate limited. Please try again later.';
    return `${heading} ${message || fallback}${retry} To continue with your own limits, add and select your OpenRouter API key in Settings.`;
  }
  const metadata = failure.error?.metadata;
  if (!metadata?.raw) return message || err.message;
  const provider = metadata.provider_name ? `${metadata.provider_name}: ` : '';
  return `${message || err.message} — ${provider}${metadata.raw}`;
}
import type {
  ChatMessages,
  ChatRequest,
  ChatResult,
  ImageGenerationRequestAspectRatio,
  ImageGenerationRequestResolution,
} from '@openrouter/sdk/models';
import type {
  CompletionResult,
  DecisionQuestion,
  DecisionResult,
  DecisionStateItem,
  ExtractionResult,
  ImageGenResult,
  Message,
  ReasoningEffort,
  ToolCall,
} from '../types';

export type SubmitCompletionParams = {
  serverURL: string;
  apiKey: string;
  model: string;
  messages: Message[];
  tools?: unknown[];
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
};

export async function submitCompletion(params: SubmitCompletionParams): Promise<CompletionResult> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });
  const maxTokens = capDemoMaxTokens(params.serverURL, params.maxTokens);

  const chatRequest = {
    model: params.model,
    messages: params.messages.map(toChatMessage),
    stream: false,
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.tools ? { tools: params.tools as ChatRequest['tools'] } : {}),
    ...(params.reasoningEffort ? { reasoning: { effort: params.reasoningEffort } } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  } satisfies ChatRequest;

  let result: ChatResult;
  try {
    result = (await client.chat.send({ chatRequest })) as ChatResult;
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }

  return fromChatResult(result);
}

function toChatMessage(message: Message): ChatMessages {
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.content ?? null,
      ...(message.tool_calls ? { toolCalls: message.tool_calls } : {}),
    } as ChatMessages;
  }
  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content ?? '',
      toolCallId: message.tool_call_id ?? '',
    } as ChatMessages;
  }
  if (message.role === 'system') {
    return { role: 'system', content: message.content ?? '' } as ChatMessages;
  }
  return { role: 'user', content: message.content ?? '' } as ChatMessages;
}

function fromChatResult(result: ChatResult): CompletionResult {
  const usage = result.usage;
  return {
    id: result.id,
    model: result.model,
    choices: result.choices.map((choice, index) => ({
      index: choice.index ?? index,
      finish_reason: choice.finishReason ?? null,
      message: {
        role: choice.message.role,
        content: normalizeContent(choice.message.content),
        reasoning: choice.message.reasoning ?? null,
        tool_calls: choice.message.toolCalls as ToolCall[] | undefined,
      },
    })),
    usage: {
      prompt_tokens: usage?.promptTokens ?? 0,
      completion_tokens: usage?.completionTokens ?? 0,
      total_tokens: usage?.totalTokens ?? 0,
      cost: usage?.cost ?? undefined,
    },
  };
}

const EXTRACTION_TIMEOUT_MS = 120_000;

export type SubmitExtractionParams = {
  serverURL: string;
  apiKey: string;
  model: string;
  instructions: string;
  schema: Record<string, unknown>;
  inputImageDataUrls: string[];
  maxTokens?: number;
};

export async function submitExtraction(params: SubmitExtractionParams): Promise<ExtractionResult> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });
  const maxTokens = capDemoMaxTokens(params.serverURL, params.maxTokens);

  try {
    const result = (await client.chat.send(
      {
        chatRequest: {
          ...(maxTokens !== undefined ? { maxTokens } : {}),
          model: params.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: params.instructions },
                ...params.inputImageDataUrls.map((url) => ({
                  type: 'image_url' as const,
                  imageUrl: { url },
                })),
              ],
            },
          ],
          responseFormat: {
            type: 'json_schema',
            jsonSchema: { name: 'extraction', schema: params.schema, strict: true },
          },
          stream: false,
        } as ChatRequest,
      },
      { timeoutMs: EXTRACTION_TIMEOUT_MS },
    )) as ChatResult;

    const content = normalizeContent(result.choices[0]?.message.content);
    let data: unknown;
    try {
      data = JSON.parse(content ?? '');
    } catch {
      throw new Error(`Response was not valid JSON: ${content}`);
    }

    const usage = result.usage;
    return {
      data,
      usage: {
        prompt_tokens: usage?.promptTokens ?? 0,
        completion_tokens: usage?.completionTokens ?? 0,
        total_tokens: usage?.totalTokens ?? 0,
        cost: usage?.cost ?? undefined,
      },
    };
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }
}

export type VisionModelOptions = {
  id: string;
  promptPrice: number;
  completionPrice: number;
};

export type ListVisionModelOptionsParams = {
  serverURL: string;
  apiKey: string;
};

export async function listVisionModelOptions(params: ListVisionModelOptionsParams): Promise<VisionModelOptions[]> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });

  try {
    const result = await client.models.list({ inputModalities: 'image' });
    return result.result.data.map((model) => ({
      id: model.id,
      promptPrice: model.pricing.prompt == null ? NaN : Number(model.pricing.prompt),
      completionPrice: model.pricing.completion == null ? NaN : Number(model.pricing.completion),
    }));
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }
}

export type ChatModelOptions = {
  id: string;
  supportsReasoning?: boolean;
  promptPrice: number;
  completionPrice: number;
};

export type ListChatModelOptionsParams = {
  serverURL: string;
  apiKey: string;
};

export async function listChatModelOptions(params: ListChatModelOptionsParams): Promise<ChatModelOptions[]> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });

  try {
    const result = await client.models.list({ outputModalities: 'text' });
    return result.result.data.map((model) => ({
      id: model.id,
      supportsReasoning: Array.isArray(model.supportedParameters) ? model.supportedParameters.includes('reasoning') : undefined,
      promptPrice: model.pricing.prompt == null ? NaN : Number(model.pricing.prompt),
      completionPrice: model.pricing.completion == null ? NaN : Number(model.pricing.completion),
    }));
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }
}

export async function listDecisionModelOptions(params: ListChatModelOptionsParams): Promise<ChatModelOptions[]> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });
  try {
    const result = await client.models.list({ outputModalities: 'decisions' });
    return result.result.data.map(model => ({ id: model.id,
      promptPrice: model.pricing.prompt == null ? NaN : Number(model.pricing.prompt),
      completionPrice: model.pricing.completion == null ? NaN : Number(model.pricing.completion) }));
  } catch (err) { throw new Error(formatRequestError(err, params.serverURL), { cause: err }); }
}

export type SubmitDecisionParams = {
  serverURL: string;
  apiKey: string;
  model: string;
  state: DecisionStateItem[];
  questions: Record<string, DecisionQuestion>;
};

export async function submitDecision(params: SubmitDecisionParams): Promise<DecisionResult> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });

  try {
    // Decisions use an operation-specific SDK server; constructor serverURL is ignored.
    const serverURL = params.serverURL.replace(/\/+$/, '') === 'https://openrouter.ai/api/v1'
      ? 'https://openrouter.ai'
      : params.serverURL;
    const result = await client.alpha.decisions.create({
      decisionsRequest: { model: params.model, state: params.state, questions: params.questions },
    }, { serverURL });
    return fromDecisionsResponse(result);
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }
}

function fromDecisionsResponse(result: unknown): DecisionResult {
  const { answers, usage } = result as {
    answers: DecisionResult['answers'];
    usage?: { inputTokens?: number; outputTokens?: number; cost?: number };
  };
  const promptTokens = usage?.inputTokens ?? 0;
  const completionTokens = usage?.outputTokens ?? 0;
  return {
    answers,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost: usage?.cost,
    },
  };
}

export type SubmitImageGenerationParams = {
  serverURL: string;
  apiKey: string;
  model: string;
  prompt: string;
  inputImageDataUrls: string[];
  aspectRatio?: string;
  resolution?: string;
};

// Image generation can legitimately take over a minute; this just bounds how long a hung
// request blocks a batch run, it isn't tuned for typical latency.
const IMAGE_GENERATION_TIMEOUT_MS = 180_000;

export async function submitImageGeneration(params: SubmitImageGenerationParams): Promise<ImageGenResult> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });

  try {
    const result = await client.images.generate({
      imageGenerationRequest: {
        model: params.model,
        prompt: params.prompt,
        n: 1,
        ...(params.inputImageDataUrls.length > 0
          ? {
              inputReferences: params.inputImageDataUrls.map((url) => ({
                type: 'image_url' as const,
                imageUrl: { url },
              })),
            }
          : {}),
        ...(params.aspectRatio
          ? { aspectRatio: params.aspectRatio as ImageGenerationRequestAspectRatio }
          : {}),
        ...(params.resolution ? { resolution: params.resolution as ImageGenerationRequestResolution } : {}),
      },
    }, { timeoutMs: IMAGE_GENERATION_TIMEOUT_MS });
    return fromImageGenerationResponse(result);
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }
}

export type ImageModelOptions = {
  id: string;
  aspectRatios: string[];
  resolutions: string[];
  supportsImageInput: boolean;
};

export type ListImageModelOptionsParams = {
  serverURL: string;
  apiKey: string;
};

export async function listImageModelOptions(params: ListImageModelOptionsParams): Promise<ImageModelOptions[]> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });

  try {
    const result = await client.images.listModels();
    return result.data.map((model) => ({
      id: model.id,
      aspectRatios: extractEnumValues(model.supportedParameters['aspect_ratio']).filter(value => !isDemoMode(params) || ['1:1', '4:3', '3:4', '16:9', '9:16'].includes(value)),
      resolutions: extractEnumValues(model.supportedParameters['resolution']).filter(value => !isDemoMode(params) || value === '1K'),
      supportsImageInput: model.architecture.inputModalities.includes('image'),
    }));
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }
}

function extractEnumValues(descriptor: unknown): string[] {
  if (descriptor && typeof descriptor === 'object' && (descriptor as { type?: string }).type === 'enum') {
    return (descriptor as { values: string[] }).values;
  }
  return [];
}

export type ImageModelPrice = { costUsd: number; unit: string };

export type GetCheapestImageOutputPriceParams = {
  serverURL: string;
  apiKey: string;
  modelId: string;
};

export async function getCheapestImageOutputPrice(
  params: GetCheapestImageOutputPriceParams,
): Promise<ImageModelPrice | undefined> {
  const slashIndex = params.modelId.indexOf('/');
  if (slashIndex === -1) return undefined;
  const author = params.modelId.slice(0, slashIndex);
  const slug = params.modelId.slice(slashIndex + 1);

  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });

  try {
    const result = await client.images.listModelEndpoints({ author, slug });
    const outputPrices = result.endpoints.flatMap((endpoint) =>
      endpoint.pricing.filter((entry) => entry.billable === 'output_image'),
    );
    if (outputPrices.length === 0) return undefined;
    const cheapest = outputPrices.reduce((min, entry) => (entry.costUsd < min.costUsd ? entry : min));
    return { costUsd: cheapest.costUsd, unit: cheapest.unit };
  } catch (err) {
    throw new Error(formatRequestError(err, params.serverURL), { cause: err });
  }
}

function fromImageGenerationResponse(result: unknown): ImageGenResult {
  const { data, usage } = result as {
    data: Array<{ b64Json: string; mediaType?: string }>;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; cost?: number };
  };
  return {
    images: data.map((item) => ({
      dataUrl: `data:${item.mediaType ?? 'image/png'};base64,${item.b64Json}`,
      mediaType: item.mediaType,
    })),
    usage: {
      prompt_tokens: usage?.promptTokens ?? 0,
      completion_tokens: usage?.completionTokens ?? 0,
      total_tokens: usage?.totalTokens ?? 0,
      cost: usage?.cost,
    },
  };
}

function normalizeContent(content: string | Array<unknown> | null | undefined): string | null {
  if (content == null) return null;
  if (typeof content === 'string') return content;
  return content
    .map((item) =>
      typeof item === 'object' && item !== null && 'text' in item ? String((item as { text: unknown }).text) : '',
    )
    .join('');
}
