import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestRunner } from './test-runner';
import type { TestJob, TestJobResult } from './test-runner';

class MockWorker {
  static instances: MockWorker[] = [];
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  terminated = false;
  lastMessage: unknown = null;

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener));
  }

  postMessage(message: unknown) {
    this.lastMessage = message;
  }

  terminate() {
    this.terminated = true;
  }

  respond(data: unknown, type = 'message') {
    for (const listener of this.listeners.get(type) ?? []) listener({ data } as MessageEvent);
  }
}

describe('TestRunner', () => {
  beforeEach(() => {
    MockWorker.instances = [];
    vi.stubGlobal('Worker', MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('runs jobs sequentially, one in flight at a time', async () => {
    const runner = new TestRunner();
    const worker = MockWorker.instances[0];
    const jobs: TestJob[] = [
      { taskId: 'a', callIndex: 0, message: {} },
      { taskId: 'a', callIndex: 1, message: {} },
    ];
    const onResult = vi.fn();

    const runPromise = runner.runSuite('return []', jobs, onResult);

    await Promise.resolve();
    await Promise.resolve();
    expect(worker.lastMessage).toMatchObject({ requestId: 0 });
    expect(onResult).not.toHaveBeenCalled();

    worker.respond({ type: 'result', requestId: 0, checks: [] });
    await Promise.resolve();
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledWith<[TestJobResult]>({ taskId: 'a', callIndex: 0, checks: [] });
    expect(worker.lastMessage).toMatchObject({ requestId: 1 });

    worker.respond({ type: 'result', requestId: 1, checks: [] });
    await runPromise;
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it('resolves an error response as a failing (suite) check', async () => {
    const runner = new TestRunner();
    const worker = MockWorker.instances[0];
    const onResult = vi.fn();

    const runPromise = runner.runSuite('bad(', [{ taskId: 'a', callIndex: 0, message: {} }], onResult);
    await Promise.resolve();
    await Promise.resolve();
    worker.respond({ type: 'error', requestId: 0, error: 'SyntaxError: oops' });
    await runPromise;

    expect(onResult).toHaveBeenCalledWith({
      taskId: 'a',
      callIndex: 0,
      checks: [{ name: '(suite)', pass: false, message: 'SyntaxError: oops' }],
    });
  });

  it('terminates and replaces the worker after a 2s timeout', async () => {
    vi.useFakeTimers();
    const runner = new TestRunner();
    const firstWorker = MockWorker.instances[0];
    const onResult = vi.fn();

    const runPromise = runner.runSuite('return []', [{ taskId: 'a', callIndex: 0, message: {} }], onResult);

    await vi.advanceTimersByTimeAsync(2000);
    await runPromise;

    expect(firstWorker.terminated).toBe(true);
    expect(MockWorker.instances).toHaveLength(2);
    expect(onResult).toHaveBeenCalledWith({
      taskId: 'a',
      callIndex: 0,
      checks: [{ name: '(suite)', pass: false, message: 'Timed out after 2000ms' }],
    });
  });

  it('cancels pending jobs without resurrecting a worker after termination', async () => {
    vi.useFakeTimers();
    const runner = new TestRunner();
    const onResult = vi.fn();
    const runPromise = runner.runSuite('return []', [
      { taskId: 'a', callIndex: 0, message: {} },
      { taskId: 'a', callIndex: 1, message: {} },
    ], onResult);
    runner.terminate();
    await runPromise;
    await vi.advanceTimersByTimeAsync(3000);
    expect(onResult).not.toHaveBeenCalled();
    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].terminated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports worker load errors without waiting for a timeout', async () => {
    const runner = new TestRunner();
    const worker = MockWorker.instances[0];
    const onResult = vi.fn();
    const runPromise = runner.runSuite('return []', [{ taskId: 'a', callIndex: 0, message: {} }], onResult);
    worker.respond({}, 'error');
    await runPromise;
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ checks: [
      { name: '(suite)', pass: false, message: 'Test worker failed to execute the suite' },
    ] }));
    expect(worker.terminated).toBe(true);
    runner.terminate();
  });
});
