export async function runWithConcurrency<T>(
  jobs: Array<() => Promise<T>>,
  concurrency: number,
  onSettle?: (index: number, result: T) => void,
  startIntervalMs = 0,
): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let nextIndex = 0;
  const interval = Number.isFinite(startIntervalMs) ? Math.max(0, startIntervalMs) : 0;
  let lastStart: number | undefined;
  let startQueue = Promise.resolve();

  async function startJob(index: number): Promise<T> {
    // One queue for the whole batch: reserve actual start times, not per-worker delays.
    const launch = startQueue.then(async () => {
      if (lastStart !== undefined) {
        let remaining = lastStart + interval - performance.now();
        while (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
          remaining = lastStart + interval - performance.now();
        }
      }
      lastStart = performance.now();
      return { result: jobs[index]() };
    });
    startQueue = launch.then(() => undefined, () => undefined);
    return (await launch).result;
  }

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex++;
      if (index >= jobs.length) return;
      const result = await (interval > 0 ? startJob(index) : jobs[index]());
      results[index] = result;
      onSettle?.(index, result);
    }
  }

  const workerCount = Number.isFinite(concurrency)
    ? Math.max(1, Math.min(Math.floor(concurrency), jobs.length)) : 1;
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
