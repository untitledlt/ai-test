import { describe, expect, it, vi } from 'vitest';
import { runWithConcurrency } from './batch-runner';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('runWithConcurrency', () => {
  it('spaces starts across all workers while respecting concurrency and result order', async () => {
    vi.useFakeTimers();
    try {
      const starts: number[] = [];
      let active = 0;
      let peak = 0;
      const onSettle = vi.fn();
      const jobs = Array.from({ length: 6 }, (_, index) => async () => {
        starts.push(performance.now());
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 2500));
        active--;
        return index;
      });
      const run = runWithConcurrency(jobs, 2, onSettle, 1000);
      await vi.advanceTimersByTimeAsync(0);
      expect(starts).toEqual([0]);
      await vi.advanceTimersByTimeAsync(999);
      expect(starts).toEqual([0]);
      await vi.advanceTimersByTimeAsync(1);
      expect(starts).toEqual([0, 1000]);
      await vi.runAllTimersAsync();
      expect(await run).toEqual([0, 1, 2, 3, 4, 5]);
      expect(starts).toEqual([0, 1000, 2500, 3500, 5000, 6000]);
      expect(peak).toBe(2);
      expect(onSettle).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts immediately after a slow sequential call when the interval already elapsed', async () => {
    vi.useFakeTimers();
    try {
      const starts: number[] = [];
      const run = runWithConcurrency([0, 1].map((index) => async () => {
        starts.push(performance.now());
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return index;
      }), 1, undefined, 1000);
      await vi.runAllTimersAsync();
      await run;
      expect(starts).toEqual([0, 3000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs all jobs and returns results in order', async () => {
    const jobs = [1, 2, 3, 4].map((n) => () => Promise.resolve(n * 10));
    const results = await runWithConcurrency(jobs, 2);
    expect(results).toEqual([10, 20, 30, 40]);
  });

  it('never runs more than `concurrency` jobs at once', async () => {
    let active = 0;
    let maxActive = 0;
    const jobs = Array.from({ length: 6 }, () => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return active;
    });

    await runWithConcurrency(jobs, 3);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('calls onSettle incrementally as each job resolves, not just at the end', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const onSettle = vi.fn();

    const jobs = [() => first.promise, () => second.promise];
    const runPromise = runWithConcurrency(jobs, 2, onSettle);

    first.resolve(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(onSettle).toHaveBeenCalledWith(0, 1);
    expect(onSettle).toHaveBeenCalledTimes(1);

    second.resolve(2);
    await runPromise;
    expect(onSettle).toHaveBeenCalledWith(1, 2);
    expect(onSettle).toHaveBeenCalledTimes(2);
  });

  it('handles an empty job list', async () => {
    const results = await runWithConcurrency([], 5);
    expect(results).toEqual([]);
  });

  it('clamps concurrency to the number of jobs', async () => {
    const jobs = [1, 2].map((n) => () => Promise.resolve(n));
    const results = await runWithConcurrency(jobs, 10);
    expect(results).toEqual([1, 2]);
  });
});
