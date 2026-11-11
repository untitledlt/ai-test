import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, allDocsByPrefix, getDoc, putDoc } from '../db/client';
import { EXAMPLES, loadExample, seedExamples } from './examples';
import type { AgentRecord } from '../db/types';

afterEach(async () => {
  vi.restoreAllMocks();
  for (const example of EXAMPLES) {
    try {
      const marker = await db.get(`_local/example-seed:${example.id}`);
      await db.remove(marker);
    } catch {
      /* Not initialized. */
    }
  }
});
describe('bundled examples', () => {
  it('seeds every tool concurrently without providers, generation, duplicate records or overwritten edits', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    await Promise.all([seedExamples(), seedExamples()]);
    for (const example of EXAMPLES)
      expect(await getDoc(`${example.type}:example-${example.id}`)).toMatchObject({
        type: example.type,
        content: example.content,
      });
    const existing = await getDoc<AgentRecord>('record:example-ticket-summary');
    await putDoc({ ...existing!, content: '{"messages":[]}', name: 'My edit' });
    await seedExamples();
    expect(await getDoc('record:example-ticket-summary')).toMatchObject({
      name: 'My edit',
      content: '{"messages":[]}',
    });
    expect(await allDocsByPrefix('provider:')).toHaveLength(0);
    expect(await allDocsByPrefix('record:example-')).toHaveLength(3);
    expect(network).not.toHaveBeenCalled();

    // Deleted examples remain deleted; loads create independent copies.
    const example = EXAMPLES[0];
    const seeded = await db.get('record:example-ticket-summary');
    await db.remove(seeded);
    await seedExamples();
    expect(await getDoc('record:example-ticket-summary')).toBeNull();
    const first = await loadExample(example);
    const second = await loadExample(example);
    expect(first).not.toBe(second);
    const records = await allDocsByPrefix<AgentRecord>('record:');
    expect(records.filter((record) => record.name === example.title)).toHaveLength(2);
    for (const record of records) expect(record.multipleResultsHistory).toBeUndefined();

    // Loading every tool preserves local drafts and provider state.
    localStorage.setItem('ai-test-agent:image-gen-draft', 'preserved');
    for (const example of EXAMPLES) {
      const route = await loadExample(example);
      expect(route).toMatch(new RegExp(`^${example.tool}/`));
      const record = await getDoc<AgentRecord>(decodeURIComponent(route.split('/').pop()!));
      expect(record).toMatchObject({ type: example.type, content: example.content });
      const content = JSON.parse(record!.content);
      expect(content.callCount ?? 1).toBe(1);
      for (const image of content.inputImages ?? []) expect(image.dataUrl).toMatch(/^data:image\/png;base64,/);
    }
    expect(await allDocsByPrefix('provider:')).toHaveLength(0);
    expect(localStorage.getItem('ai-test-agent:image-gen-draft')).toBe('preserved');
    expect(network).not.toHaveBeenCalled();
  });
});
