import { describe, expect, it } from 'vitest';
import { checkRunLimits, measurePayload, DEMO_TEXT_BYTES, DEMO_PAYLOAD_BYTES, WARN_TEXT_BYTES } from './run-limits';
import { DEMO_URL, isDemoMode } from './onboarding';

const small = { taskCount: 5, activeTaskCount: 5, callCount: 2, payloads: [{ prompt: 'Hello' }] };

describe('run limits', () => {
  it('recognizes the demo endpoint without relying on a label or key', () => {
    expect(isDemoMode({ serverURL: DEMO_URL })).toBe(true);
    expect(isDemoMode({ serverURL: DEMO_URL.slice(0, -1) })).toBe(true);
    expect(isDemoMode({ serverURL: `${DEMO_URL}other` })).toBe(false);
    expect(isDemoMode(null)).toBe(false);
  });
  it('allows exactly five demo tasks and two calls', () => {
    expect(checkRunLimits(true, small)).toEqual({ blocked: false, reasons: [] });
    expect(checkRunLimits(true, { ...small, taskCount: 6, activeTaskCount: 1 }).blocked).toBe(true);
    expect(checkRunLimits(true, { ...small, callCount: 3 }).blocked).toBe(true);
  });
  it('warns only above five active tasks or five calls outside demo', () => {
    expect(checkRunLimits(false, { ...small, taskCount: 9, callCount: 5 }).reasons).toEqual([]);
    expect(checkRunLimits(false, { ...small, activeTaskCount: 6 }).reasons).toHaveLength(1);
    expect(checkRunLimits(false, { ...small, callCount: 6 }).reasons).toHaveLength(1);
  });
  it('measures UTF-8 bytes and separates encoded images from text', () => {
    expect(measurePayload('😀').text).toBe(6);
    const sizes = measurePayload({ image: 'data:image/png;base64,' + 'A'.repeat(10000), prompt: 'hi' });
    expect(sizes.total).toBeGreaterThan(10000);
    expect(sizes.text).toBeLessThan(100);
  });
  it('checks every request at exact size boundaries', () => {
    const atLimit = 'x'.repeat(DEMO_TEXT_BYTES - 2);
    expect(checkRunLimits(true, { ...small, payloads: [atLimit] }).blocked).toBe(false);
    expect(checkRunLimits(true, { ...small, payloads: ['small', atLimit + 'x'] }).blocked).toBe(true);
    expect(checkRunLimits(false, { ...small, payloads: ['x'.repeat(WARN_TEXT_BYTES)] }).reasons).toHaveLength(1);
    const image = 'data:image/png;base64,' + 'A'.repeat(DEMO_PAYLOAD_BYTES);
    expect(checkRunLimits(true, { ...small, payloads: [image] }).blocked).toBe(true);
    expect(checkRunLimits(false, { ...small, payloads: [image] }).blocked).toBe(false);
    expect(checkRunLimits(false, { ...small, payloads: [image] }).reasons).toHaveLength(1);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 21])('rejects invalid persisted call counts: %s', (callCount) => {
    expect(checkRunLimits(false, { ...small, callCount }).blocked).toBe(true);
  });
});
