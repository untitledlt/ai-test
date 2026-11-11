import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitDecision, submitCompletion, submitExtraction, submitImageGeneration,
  listChatModelOptions, listVisionModelOptions, listDecisionModelOptions,
  listImageModelOptions, getCheapestImageOutputPrice } from './openrouter-client';
import { DEMO_URL, OPENROUTER_URL } from './onboarding';

afterEach(() => vi.unstubAllGlobals());

describe('decision SDK request destinations', () => {
  it.each([
    [OPENROUTER_URL, 'https://openrouter.ai/api/alpha/decisions'],
    [DEMO_URL, `${DEMO_URL}api/alpha/decisions`],
    ['https://custom.example/v1', 'https://custom.example/v1/api/alpha/decisions'],
  ])('sends credentials only to the selected server: %s', async (serverURL, expectedURL) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Test stop', code: 400 } }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    await expect(submitDecision({ serverURL, apiKey: 'test-only-key', model: 'test/model',
      state: ['hello'], questions: {} })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = fetch.mock.calls[0][0] as Request;
    expect(request.url).toBe(expectedURL);
    expect(request.headers.get('Authorization')).toBe('Bearer test-only-key');
  });
});

describe('other SDK request destinations', () => {
  const operations = [
    { name: 'chat', path: '/chat/completions', run: (serverURL: string) => submitCompletion({ serverURL, apiKey: 'test-only-key', model: 'test/model', messages: [] }) },
    { name: 'extraction', path: '/chat/completions', run: (serverURL: string) => submitExtraction({ serverURL, apiKey: 'test-only-key', model: 'test/model', instructions: 'Extract', schema: {}, inputImageDataUrls: [] }) },
    { name: 'images', path: '/images', run: (serverURL: string) => submitImageGeneration({ serverURL, apiKey: 'test-only-key', model: 'test/model', prompt: 'Test', inputImageDataUrls: [] }) },
    { name: 'chat catalog', path: '/models', run: (serverURL: string) => listChatModelOptions({ serverURL, apiKey: 'test-only-key' }) },
    { name: 'vision catalog', path: '/models', run: (serverURL: string) => listVisionModelOptions({ serverURL, apiKey: 'test-only-key' }) },
    { name: 'decision catalog', path: '/models', run: (serverURL: string) => listDecisionModelOptions({ serverURL, apiKey: 'test-only-key' }) },
    { name: 'image catalog', path: '/images/models', run: (serverURL: string) => listImageModelOptions({ serverURL, apiKey: 'test-only-key' }) },
    { name: 'image pricing', path: '/images/models/test/model/endpoints', run: (serverURL: string) => getCheapestImageOutputPrice({ serverURL, apiKey: 'test-only-key', modelId: 'test/model' }) },
  ];

  describe.each([OPENROUTER_URL, DEMO_URL, 'https://custom.example/v1'])('%s', (serverURL) => {
    it.each(operations)('$name sends credentials only to the selected server', async ({ run, path }) => {
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Test stop', code: 400 } }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      }));
      vi.stubGlobal('fetch', fetch);
      await expect(run(serverURL)).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
      const request = fetch.mock.calls[0][0] as Request;
      const url = new URL(request.url);
      expect(`${url.origin}${url.pathname}`).toBe(`${serverURL.replace(/\/+$/, '')}${path}`);
      expect(request.headers.get('Authorization')).toBe('Bearer test-only-key');
    });
  });
});
