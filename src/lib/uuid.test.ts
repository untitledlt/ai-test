import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from './uuid';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUUID', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to crypto.randomUUID when it is available', () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    expect(randomUUID()).toBe('11111111-1111-4111-8111-111111111111');
    expect(spy).toHaveBeenCalled();
  });

  it('falls back to a crypto.getRandomValues-based v4 UUID when crypto.randomUUID is unavailable', () => {
    // Simulates a non-secure context (e.g. LAN access over plain http), where
    // crypto.randomUUID is undefined but crypto.getRandomValues still works.
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    const id = randomUUID();
    expect(id).toMatch(UUID_V4_PATTERN);

    vi.unstubAllGlobals();
  });

  it('produces different ids on each call via the fallback path', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    const a = randomUUID();
    const b = randomUUID();
    expect(a).not.toBe(b);

    vi.unstubAllGlobals();
  });
});
