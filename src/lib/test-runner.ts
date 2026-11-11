import type { CheckResult } from '../types';

export type TestJob = {
  taskId: string;
  callIndex: number;
  message: unknown;
};

export type TestJobResult = {
  taskId: string;
  callIndex: number;
  checks: CheckResult[];
};

type WorkerResponse =
  | { type: 'result'; requestId: number; checks: CheckResult[] }
  | { type: 'error'; requestId: number; error: string };

const JOB_TIMEOUT_MS = 2000;

export class TestRunner {
  private worker: Worker;
  private nextRequestId = 0;
  private stopped = false;
  private cancelPending?: () => void;

  constructor() {
    this.worker = createWorker();
  }

  async runSuite(
    suiteSource: string,
    jobs: TestJob[],
    onResult: (result: TestJobResult) => void,
  ): Promise<void> {
    for (const job of jobs) {
      if (this.stopped) break;
      const checks = await this.runOne(suiteSource, job.message);
      if (this.stopped) break;
      onResult({ taskId: job.taskId, callIndex: job.callIndex, checks });
    }
  }

  private runOne(suiteSource: string, message: unknown): Promise<CheckResult[]> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve) => {
      let settled = false;
      const worker = this.worker;

      const finish = (checks: CheckResult[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        worker.removeEventListener('messageerror', handleError);
        this.cancelPending = undefined;
        resolve(checks);
      };

      const timeoutId = setTimeout(() => {
        if (settled) return;
        worker.terminate();
        this.worker = createWorker();
        finish([{ name: '(suite)', pass: false, message: `Timed out after ${JOB_TIMEOUT_MS}ms` }]);
      }, JOB_TIMEOUT_MS);

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (!event.data || event.data.requestId !== requestId || settled) return;
        if (event.data.type === 'error') {
          finish([{ name: '(suite)', pass: false, message: event.data.error }]);
        } else if (event.data.type === 'result' && Array.isArray(event.data.checks)) {
          finish(event.data.checks);
        }
      };

      const handleError = () => {
        if (settled) return;
        worker.terminate();
        this.worker = createWorker();
        finish([{ name: '(suite)', pass: false, message: 'Test worker failed to execute the suite' }]);
      };

      this.cancelPending = () => finish([]);
      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);
      worker.addEventListener('messageerror', handleError);
      try {
        worker.postMessage({ type: 'run', requestId, suiteSource, message });
      } catch {
        handleError();
      }
    });
  }

  terminate(): void {
    this.stopped = true;
    this.cancelPending?.();
    this.worker.terminate();
  }
}

function createWorker(): Worker {
  return new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' });
}
