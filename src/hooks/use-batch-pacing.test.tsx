import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBatchPacing } from './use-batch-pacing';

describe('batch pacing settings', () => {
  it('uses separate demo and personal defaults and preserves edits across mode switches', () => {
    const { result, rerender } = renderHook(({ demo }) => useBatchPacing(demo), { initialProps: { demo: false } });
    expect(result.current.value).toEqual({ concurrency: 5, startIntervalMs: 0 });
    rerender({ demo: true });
    expect(result.current.value).toEqual({ concurrency: 1, startIntervalMs: 1000 });
    act(() => result.current.onChange({ concurrency: 2, startIntervalMs: 5000 }));
    rerender({ demo: false });
    expect(result.current.value).toEqual({ concurrency: 5, startIntervalMs: 0 });
    rerender({ demo: true });
    expect(result.current.value).toEqual({ concurrency: 2, startIntervalMs: 5000 });
  });
});
