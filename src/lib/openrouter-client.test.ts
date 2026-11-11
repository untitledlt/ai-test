import { describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const imagesGenerateMock = vi.fn();
const imagesListModelsMock = vi.fn();
const imagesListModelEndpointsMock = vi.fn();
const chatSendMock = vi.fn();
const modelsListMock = vi.fn();
vi.mock('@openrouter/sdk', () => ({
  OpenRouter: vi.fn().mockImplementation(function () {
    return {
      alpha: { decisions: { create: createMock } },
      chat: { send: chatSendMock },
      models: { list: modelsListMock },
      images: {
        generate: imagesGenerateMock,
        listModels: imagesListModelsMock,
        listModelEndpoints: imagesListModelEndpointsMock,
      },
    };
  }),
}));

import {
  formatRequestError,
  getCheapestImageOutputPrice,
  listImageModelOptions,
  listDecisionModelOptions,
  listVisionModelOptions,
  listChatModelOptions,
  submitDecision,
  submitCompletion,
  submitExtraction,
  submitImageGeneration,
} from './openrouter-client';
import { DEMO_URL, OPENROUTER_URL } from './onboarding';

describe('demo output token caps', () => {
  it.each([
    [DEMO_URL, undefined, 2048],
    [DEMO_URL, 100000, 2048],
    [DEMO_URL, 512, 512],
    [DEMO_URL, NaN, 2048],
    [OPENROUTER_URL, undefined, undefined],
    [OPENROUTER_URL, 100000, 100000],
  ])('caps chat and extraction for %s with requested limit %s', async (serverURL, requested, expected) => {
    for (const operation of ['chat', 'extract']) {
      chatSendMock.mockRejectedValueOnce(new Error('Test stop'));
      const request = operation === 'chat'
        ? submitCompletion({ serverURL, apiKey: 'test', model: 'test', messages: [], maxTokens: requested })
        : submitExtraction({ serverURL, apiKey: 'test', model: 'test', instructions: 'Extract', schema: {}, inputImageDataUrls: [], maxTokens: requested });
      await expect(request).rejects.toThrow('Test stop');
      const sent = chatSendMock.mock.lastCall![0].chatRequest;
      expect(sent.maxTokens).toBe(expected);
      if (expected === undefined) expect(sent).not.toHaveProperty('maxTokens');
    }
  });
});

describe('submitDecision', () => {
  it('calls alpha.decisions.create with the given model/state/questions and returns its answers', async () => {
    const canned = {
      answers: { matches: { type: 'noul', noul: 0.9 } },
      usage: { inputTokens: 100, outputTokens: 20, cost: 0.0001 },
    };
    createMock.mockResolvedValueOnce(canned);

    const result = await submitDecision({
      serverURL: 'https://openrouter.ai/api/v1',
      apiKey: 'key',
      model: '~typesafe/jev-latest',
      state: ['hello'],
      questions: { matches: { type: 'noul', instructions: 'x', criteria: { true: 'y', false: 'z' } } },
    });

    expect(createMock).toHaveBeenCalledWith({
      decisionsRequest: {
        model: '~typesafe/jev-latest',
        state: ['hello'],
        questions: { matches: { type: 'noul', instructions: 'x', criteria: { true: 'y', false: 'z' } } },
      },
    }, { serverURL: 'https://openrouter.ai' });
    expect(result.answers).toEqual(canned.answers);
    expect(result.usage).toEqual({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost: 0.0001 });
  });

  it('defaults usage fields to 0 and cost to undefined when the response has no usage', async () => {
    createMock.mockResolvedValueOnce({ answers: {} });

    const result = await submitDecision({ serverURL: 'url', apiKey: 'k', model: 'm', state: [], questions: {} });

    expect(result.usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: undefined });
  });

  it('wraps a thrown error in a plain Error', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));
    await expect(
      submitDecision({ serverURL: 'url', apiKey: 'k', model: 'm', state: [], questions: {} }),
    ).rejects.toThrow('boom');
  });
});

describe('submitImageGeneration', () => {
  it('calls images.generate with the given model/prompt/inputReferences and returns decoded images + usage', async () => {
    const canned = {
      created: 1700000000,
      data: [{ b64Json: 'AAA', mediaType: 'image/png' }],
      usage: { promptTokens: 50, completionTokens: 1290, totalTokens: 1340, cost: 0.002 },
    };
    imagesGenerateMock.mockResolvedValueOnce(canned);

    const result = await submitImageGeneration({
      serverURL: 'https://openrouter.ai/api/v1',
      apiKey: 'key',
      model: 'google/gemini-image',
      prompt: 'a red bicycle',
      inputImageDataUrls: ['data:image/jpeg;base64,BBB'],
    });

    expect(imagesGenerateMock).toHaveBeenCalledWith(
      {
        imageGenerationRequest: {
          model: 'google/gemini-image',
          prompt: 'a red bicycle',
          n: 1,
          inputReferences: [{ type: 'image_url', imageUrl: { url: 'data:image/jpeg;base64,BBB' } }],
        },
      },
      { timeoutMs: expect.any(Number) },
    );
    expect(result).toEqual({
      images: [{ dataUrl: 'data:image/png;base64,AAA', mediaType: 'image/png' }],
      usage: { prompt_tokens: 50, completion_tokens: 1290, total_tokens: 1340, cost: 0.002 },
    });
  });

  it('omits inputReferences when no input images are given', async () => {
    imagesGenerateMock.mockResolvedValueOnce({ created: 1, data: [], usage: undefined });

    await submitImageGeneration({
      serverURL: 'url',
      apiKey: 'k',
      model: 'm',
      prompt: 'p',
      inputImageDataUrls: [],
    });

    expect(imagesGenerateMock).toHaveBeenCalledWith(
      { imageGenerationRequest: { model: 'm', prompt: 'p', n: 1 } },
      { timeoutMs: expect.any(Number) },
    );
  });

  it('defaults usage fields to 0 and cost to undefined when the response has no usage', async () => {
    imagesGenerateMock.mockResolvedValueOnce({ created: 1, data: [] });

    const result = await submitImageGeneration({
      serverURL: 'url',
      apiKey: 'k',
      model: 'm',
      prompt: 'p',
      inputImageDataUrls: [],
    });

    expect(result.usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: undefined });
  });

  it('defaults a missing mediaType to image/png when building the data URL', async () => {
    imagesGenerateMock.mockResolvedValueOnce({ created: 1, data: [{ b64Json: 'CCC' }] });

    const result = await submitImageGeneration({
      serverURL: 'url',
      apiKey: 'k',
      model: 'm',
      prompt: 'p',
      inputImageDataUrls: [],
    });

    expect(result.images).toEqual([{ dataUrl: 'data:image/png;base64,CCC', mediaType: undefined }]);
  });

  it('wraps a thrown error in a plain Error', async () => {
    imagesGenerateMock.mockRejectedValueOnce(new Error('boom'));
    await expect(
      submitImageGeneration({ serverURL: 'url', apiKey: 'k', model: 'm', prompt: 'p', inputImageDataUrls: [] }),
    ).rejects.toThrow('boom');
  });

  it('passes aspectRatio and resolution through to images.generate when given', async () => {
    imagesGenerateMock.mockResolvedValueOnce({ created: 1, data: [] });

    await submitImageGeneration({
      serverURL: 'url',
      apiKey: 'k',
      model: 'm',
      prompt: 'p',
      inputImageDataUrls: [],
      aspectRatio: '16:9',
      resolution: '2K',
    });

    expect(imagesGenerateMock).toHaveBeenCalledWith(
      { imageGenerationRequest: { model: 'm', prompt: 'p', n: 1, aspectRatio: '16:9', resolution: '2K' } },
      { timeoutMs: expect.any(Number) },
    );
  });

  it('passes a timeout so a hung request eventually rejects instead of blocking forever', async () => {
    imagesGenerateMock.mockResolvedValueOnce({ created: 1, data: [] });

    await submitImageGeneration({ serverURL: 'url', apiKey: 'k', model: 'm', prompt: 'p', inputImageDataUrls: [] });

    const [, options] = imagesGenerateMock.mock.calls[0];
    expect(options.timeoutMs).toBeGreaterThan(0);
  });

  it('wraps a timeout rejection from the SDK in a plain Error', async () => {
    imagesGenerateMock.mockRejectedValueOnce(new Error('Request timed out'));
    await expect(
      submitImageGeneration({ serverURL: 'url', apiKey: 'k', model: 'm', prompt: 'p', inputImageDataUrls: [] }),
    ).rejects.toThrow('Request timed out');
  });
});

describe('listImageModelOptions', () => {
  it('maps each model to its aspect-ratio and resolution enum values', async () => {
    imagesListModelsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'google/gemini-image',
          architecture: { inputModalities: ['text', 'image'], outputModalities: ['image'] },
          supportedParameters: {
            aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] },
            resolution: { type: 'enum', values: ['1K', '2K'] },
          },
        },
        {
          id: 'meta/muse-image',
          architecture: { inputModalities: ['text'], outputModalities: ['image'] },
          supportedParameters: {},
        },
      ],
    });

    const result = await listImageModelOptions({ serverURL: 'url', apiKey: 'k' });

    expect(result).toEqual([
      {
        id: 'google/gemini-image',
        aspectRatios: ['1:1', '16:9'],
        resolutions: ['1K', '2K'],
        supportsImageInput: true,
      },
      { id: 'meta/muse-image', aspectRatios: [], resolutions: [], supportsImageInput: false },
    ]);
  });

  it('ignores a non-enum capability descriptor for aspect_ratio/resolution', async () => {
    imagesListModelsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'range/model',
          architecture: { inputModalities: ['text'], outputModalities: ['image'] },
          supportedParameters: { aspect_ratio: { type: 'range', min: 1, max: 2 } },
        },
      ],
    });

    const result = await listImageModelOptions({ serverURL: 'url', apiKey: 'k' });

    expect(result).toEqual([
      { id: 'range/model', aspectRatios: [], resolutions: [], supportsImageInput: false },
    ]);
  });

  it('wraps a thrown error in a plain Error', async () => {
    imagesListModelsMock.mockRejectedValueOnce(new Error('boom'));
    await expect(listImageModelOptions({ serverURL: 'url', apiKey: 'k' })).rejects.toThrow('boom');
  });
});

describe('getCheapestImageOutputPrice', () => {
  it('splits the model id into author/slug and returns the cheapest output_image price', async () => {
    imagesListModelEndpointsMock.mockResolvedValueOnce({
      id: 'google/gemini-image',
      endpoints: [
        {
          pricing: [
            { billable: 'input_image', costUsd: 0, unit: 'image' },
            { billable: 'output_image', costUsd: 0.02, unit: 'image', variant: '1k' },
            { billable: 'output_image', costUsd: 0.04, unit: 'image', variant: '2k' },
          ],
        },
      ],
    });

    const result = await getCheapestImageOutputPrice({
      serverURL: 'url',
      apiKey: 'k',
      modelId: 'google/gemini-image',
    });

    expect(imagesListModelEndpointsMock).toHaveBeenCalledWith({ author: 'google', slug: 'gemini-image' });
    expect(result).toEqual({ costUsd: 0.02, unit: 'image' });
  });

  it('picks the cheapest price across multiple provider endpoints', async () => {
    imagesListModelEndpointsMock.mockResolvedValueOnce({
      id: 'm',
      endpoints: [
        { pricing: [{ billable: 'output_image', costUsd: 0.05, unit: 'image' }] },
        { pricing: [{ billable: 'output_image', costUsd: 0.01, unit: 'image' }] },
      ],
    });

    const result = await getCheapestImageOutputPrice({ serverURL: 'url', apiKey: 'k', modelId: 'a/m' });

    expect(result).toEqual({ costUsd: 0.01, unit: 'image' });
  });

  it('returns undefined when no endpoint has an output_image price', async () => {
    imagesListModelEndpointsMock.mockResolvedValueOnce({
      id: 'm',
      endpoints: [{ pricing: [{ billable: 'input_image', costUsd: 0, unit: 'image' }] }],
    });

    const result = await getCheapestImageOutputPrice({ serverURL: 'url', apiKey: 'k', modelId: 'a/m' });

    expect(result).toBeUndefined();
  });

  it('returns undefined for a model id with no slash', async () => {
    const result = await getCheapestImageOutputPrice({ serverURL: 'url', apiKey: 'k', modelId: 'noauthor' });

    expect(result).toBeUndefined();
    expect(imagesListModelEndpointsMock).not.toHaveBeenCalled();
  });

  it('wraps a thrown error in a plain Error', async () => {
    imagesListModelEndpointsMock.mockRejectedValueOnce(new Error('boom'));
    await expect(
      getCheapestImageOutputPrice({ serverURL: 'url', apiKey: 'k', modelId: 'a/m' }),
    ).rejects.toThrow('boom');
  });
});

describe('submitExtraction', () => {
  it('sends instructions + image parts and the JSON schema, and parses the JSON response', async () => {
    chatSendMock.mockResolvedValueOnce({
      id: '1',
      model: 'm',
      choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: '{"merchant":"Acme"}' } }],
      usage: { promptTokens: 500, completionTokens: 40, totalTokens: 540, cost: 0.003 },
    });

    const result = await submitExtraction({
      serverURL: 'url',
      apiKey: 'k',
      model: 'openai/gpt-5-image',
      instructions: 'Extract the receipt',
      schema: { type: 'object', properties: { merchant: { type: 'string' } } },
      inputImageDataUrls: ['data:image/jpeg;base64,AAA'],
    });

    expect(chatSendMock).toHaveBeenCalledWith(
      {
        chatRequest: {
          model: 'openai/gpt-5-image',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract the receipt' },
                { type: 'image_url', imageUrl: { url: 'data:image/jpeg;base64,AAA' } },
              ],
            },
          ],
          responseFormat: {
            type: 'json_schema',
            jsonSchema: {
              name: 'extraction',
              schema: { type: 'object', properties: { merchant: { type: 'string' } } },
              strict: true,
            },
          },
          stream: false,
        },
      },
      { timeoutMs: expect.any(Number) },
    );
    expect(result).toEqual({
      data: { merchant: 'Acme' },
      usage: { prompt_tokens: 500, completion_tokens: 40, total_tokens: 540, cost: 0.003 },
    });
  });

  it('sends one image_url part per input image', async () => {
    chatSendMock.mockResolvedValueOnce({
      id: '1',
      model: 'm',
      choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: '{}' } }],
      usage: undefined,
    });

    await submitExtraction({
      serverURL: 'url',
      apiKey: 'k',
      model: 'm',
      instructions: 'x',
      schema: {},
      inputImageDataUrls: ['data:a', 'data:b'],
    });

    const [{ chatRequest }] = chatSendMock.mock.calls[0];
    expect(chatRequest.messages[0].content).toEqual([
      { type: 'text', text: 'x' },
      { type: 'image_url', imageUrl: { url: 'data:a' } },
      { type: 'image_url', imageUrl: { url: 'data:b' } },
    ]);
  });

  it('throws when the response content is not valid JSON', async () => {
    chatSendMock.mockResolvedValueOnce({
      id: '1',
      model: 'm',
      choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'not json' } }],
      usage: undefined,
    });

    await expect(
      submitExtraction({ serverURL: 'url', apiKey: 'k', model: 'm', instructions: 'x', schema: {}, inputImageDataUrls: [] }),
    ).rejects.toThrow(/not valid JSON/);
  });

  it('wraps a thrown error in a plain Error', async () => {
    chatSendMock.mockRejectedValueOnce(new Error('boom'));
    await expect(
      submitExtraction({ serverURL: 'url', apiKey: 'k', model: 'm', instructions: 'x', schema: {}, inputImageDataUrls: [] }),
    ).rejects.toThrow('boom');
  });
});

describe('listVisionModelOptions', () => {
  it('fetches vision-capable models with parsed prompt/completion pricing', async () => {
    modelsListMock.mockResolvedValueOnce({
      result: {
        data: [
          {
            id: 'openai/gpt-5-image',
            architecture: { inputModalities: ['text', 'image'] },
            pricing: { prompt: '0.000002', completion: '0.00001' },
          },
        ],
      },
    });

    const result = await listVisionModelOptions({ serverURL: 'url', apiKey: 'k' });

    expect(modelsListMock).toHaveBeenCalledWith({ inputModalities: 'image' });
    expect(result).toEqual([{ id: 'openai/gpt-5-image', promptPrice: 0.000002, completionPrice: 0.00001 }]);
  });

  it('keeps missing pricing unknown', async () => {
    modelsListMock.mockResolvedValueOnce({
      result: { data: [{ id: 'm', architecture: { inputModalities: ['image'] }, pricing: {} }] },
    });

    const result = await listVisionModelOptions({ serverURL: 'url', apiKey: 'k' });

    expect(result).toEqual([{ id: 'm', promptPrice: NaN, completionPrice: NaN }]);
  });

  it('wraps a thrown error in a plain Error', async () => {
    modelsListMock.mockRejectedValueOnce(new Error('boom'));
    await expect(listVisionModelOptions({ serverURL: 'url', apiKey: 'k' })).rejects.toThrow('boom');
  });
});

describe('formatRequestError', () => {
  it('appends the provider name and raw upstream error when OpenRouter supplies metadata', () => {
    const err = Object.assign(new Error('Provider returned error'), {
      error: { metadata: { provider_name: 'OpenAI', raw: 'Invalid image: unsupported format' } },
    });

    expect(formatRequestError(err)).toBe(
      'Provider returned error — OpenAI: Invalid image: unsupported format',
    );
  });

  it('falls back to the bare message when there is no provider metadata', () => {
    expect(formatRequestError(new Error('boom'))).toBe('boom');
  });

  it('omits the provider name when metadata has only raw', () => {
    const err = Object.assign(new Error('Provider returned error'), {
      error: { metadata: { raw: 'rate limited' } },
    });

    expect(formatRequestError(err)).toBe('Provider returned error — rate limited');
  });

  it('stringifies non-Error values', () => {
    expect(formatRequestError('plain string')).toBe('plain string');
  });
});

describe('submitImageGeneration provider error detail', () => {
  it('surfaces the provider name and raw error from a BadGateway-style failure', async () => {
    imagesGenerateMock.mockRejectedValueOnce(
      Object.assign(new Error('Provider returned error'), {
        error: { metadata: { provider_name: 'OpenAI', raw: 'content_policy_violation' } },
      }),
    );

    await expect(
      submitImageGeneration({ serverURL: 'url', apiKey: 'k', model: 'm', prompt: 'p', inputImageDataUrls: [] }),
    ).rejects.toThrow('Provider returned error — OpenAI: content_policy_violation');
  });
});

describe('demo quota errors', () => {
  const message = 'Weekly demo spending limit reached ($0.20 per IP). Try again after the weekly reset or use your own OpenRouter key.';
  function quotaError(retryAfter?: string) {
    return Object.assign(new Error('Request failed'), {
      statusCode: 429,
      error: { code: 429, message },
      headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
    });
  }

  it.each(['chat', 'extract', 'decision', 'image'])('surfaces the quota and retry guidance for %s', async (tool) => {
    const params = { serverURL: DEMO_URL, apiKey: 'demo', model: 'example' };
    const error = quotaError('3600');
    let request: Promise<unknown>;
    if (tool === 'chat') {
      chatSendMock.mockRejectedValueOnce(error);
      request = submitCompletion({ ...params, messages: [] });
    } else if (tool === 'extract') {
      chatSendMock.mockRejectedValueOnce(error);
      request = submitExtraction({ ...params, instructions: '', schema: {}, inputImageDataUrls: [] });
    } else if (tool === 'decision') {
      createMock.mockRejectedValueOnce(error);
      request = submitDecision({ ...params, state: [], questions: {} });
    } else {
      imagesGenerateMock.mockRejectedValueOnce(error);
      request = submitImageGeneration({ ...params, prompt: '', inputImageDataUrls: [] });
    }
    await expect(request).rejects.toThrow(`Demo limit reached. ${message} Retry in about 1 hour. To continue with your own limits, add and select your OpenRouter API key in Settings.`);
  });

  it.each([undefined, 'invalid'])('keeps the server explanation without a usable retry header (%s)', (retryAfter) => {
    const formatted = formatRequestError(quotaError(retryAfter), DEMO_URL);
    expect(formatted).toContain(message);
    expect(formatted).toContain('Settings');
    expect(formatted).not.toContain('Retry in about');
  });

  it('supports HTTP-date Retry-After', () => {
    const date = new Date(Date.now() + 30 * 60 * 1000).toUTCString();
    expect(formatRequestError(quotaError(date), DEMO_URL)).toContain('Retry in about 30 minutes');
  });

  it('reads a generic SDK HTTP error body', () => {
    const error = Object.assign(new Error('HTTP 429'), {
      statusCode: 429, body: JSON.stringify({ error: { code: 429, message } }),
    });
    expect(formatRequestError(error, DEMO_URL)).toContain(message);
  });

  it('does not label personal-provider rate limits as demo limits', () => {
    const error = quotaError('3600');
    expect(formatRequestError(error, OPENROUTER_URL)).toBe(message);
  });
});

describe('demo service limits', () => {
  it.each([
    [402, 'The demo service has reached its spending limit. Try again later or use your own OpenRouter key.', undefined, 'Demo spending limit reached.'],
    [429, 'The demo service is temporarily rate limited. Try again later or use your own OpenRouter key.', '60', 'Demo limit reached.'],
  ])('handles HTTP %s for structured and generic SDK errors', (status, message, retryAfter, heading) => {
    for (const details of [{ error: { code: status, message } }, { body: JSON.stringify({ error: { code: status, message } }) }]) {
      const error = Object.assign(new Error('Request failed'), {
        statusCode: status,
        headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
        ...details,
      });
      const result = formatRequestError(error, DEMO_URL);
      expect(result).toContain(heading);
      expect(result).toContain(message);
      expect(result).toContain('OpenRouter API key in Settings');
      if (retryAfter) expect(result).toContain('Retry in about 1 minute.');
      else expect(result).not.toContain('Retry in about');
      expect(formatRequestError(error, OPENROUTER_URL)).toBe(message);
    }
  });

  it('provides a spending-limit fallback without a server explanation', () => {
    const error = Object.assign(new Error('HTTP 402'), { statusCode: 402 });
    expect(formatRequestError(error, DEMO_URL)).toContain('The demo service has reached its spending limit.');
  });
});


describe('decisions-specific discovery', () => {
  it('requests only decisions models and keeps unknown pricing unknown', async () => {
    modelsListMock.mockResolvedValueOnce({ result: { data: [{ id: 'demo/decision', pricing: {} }] } });
    expect(await listDecisionModelOptions({ serverURL: DEMO_URL, apiKey: 'dummy' })).toEqual([{ id: 'demo/decision', promptPrice: NaN, completionPrice: NaN }]);
    expect(modelsListMock).toHaveBeenLastCalledWith({ outputModalities: 'decisions' });
  });
});


it('distinguishes temporary upstream spending capacity from exhausted owner credit', () => {
  const error = Object.assign(new Error('HTTP 402'), { statusCode: 402, error: { message: 'The demo service is temporarily at its spending capacity. Try again later or use your own OpenRouter key.' } });
  expect(formatRequestError(error, DEMO_URL)).toContain('Demo service unavailable.');
  expect(formatRequestError(error, DEMO_URL)).not.toContain('Demo spending limit reached.');
});

describe('non-quota API errors', () => {
  const message = 'OpenRouter could not complete the demo request.';
  it.each([
    { error: { code: 404, message } },
    { body: JSON.stringify({ error: { code: 404, message } }) },
  ])('preserves the 404 response message: %j', async (details) => {
    chatSendMock.mockRejectedValueOnce(Object.assign(new Error('Request failed'), { statusCode: 404, ...details }));
    await expect(submitCompletion({ serverURL: DEMO_URL, apiKey: 'demo', model: 'example', messages: [] })).rejects.toThrow(message);
  });
});

describe('chat reasoning capabilities', () => {
  it('retains known support and leaves custom-provider capability gaps unknown', async () => {
    modelsListMock.mockResolvedValueOnce({ result: { data: [
      { id: 'tools-only', pricing: {}, supportedParameters: ['tools'] },
      { id: 'reasoning', pricing: {}, supportedParameters: ['reasoning'] },
      { id: 'custom', pricing: {} },
    ] } });
    const options = await listChatModelOptions({ serverURL: OPENROUTER_URL, apiKey: 'test' });
    expect(options.map(option => option.supportsReasoning)).toEqual([false, true, undefined]);
  });
});
