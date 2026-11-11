export type CheckResult = { name: string; pass: boolean; message?: string };

type SuiteCheck = { name: string; fn: (message: unknown) => void | Promise<void> };

type RunMessage = { type: 'run'; requestId: number; suiteSource: string; message: unknown };

class AssertionError extends Error {}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (!Object.is(actual, expected)) {
        throw new AssertionError(`expected ${stringify(actual)} to be ${stringify(expected)}`);
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new AssertionError(`expected ${stringify(actual)} to equal ${stringify(expected)}`);
      }
    },
    toContain(item: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new AssertionError(`expected ${stringify(actual)} to contain ${stringify(item)}`);
        }
        return;
      }
      if (typeof actual === 'string') {
        if (!actual.includes(String(item))) {
          throw new AssertionError(`expected "${actual}" to contain "${String(item)}"`);
        }
        return;
      }
      throw new AssertionError(`toContain requires an array or string, got ${stringify(actual)}`);
    },
    toMatch(pattern: string | RegExp) {
      const str = String(actual);
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!regex.test(str)) {
        throw new AssertionError(`expected "${str}" to match ${String(pattern)}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new AssertionError(`expected ${stringify(actual)} to be truthy`);
    },
    toBeFalsy() {
      if (actual) throw new AssertionError(`expected ${stringify(actual)} to be falsy`);
    },
    toBeDefined() {
      if (actual === undefined) throw new AssertionError('expected value to be defined');
    },
    toBeGreaterThan(n: number) {
      if (!(typeof actual === 'number' && actual > n)) {
        throw new AssertionError(`expected ${stringify(actual)} to be greater than ${n}`);
      }
    },
    toBeLessThan(n: number) {
      if (!(typeof actual === 'number' && actual < n)) {
        throw new AssertionError(`expected ${stringify(actual)} to be less than ${n}`);
      }
    },
  };
}

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  const { type, requestId, suiteSource, message } = event.data;
  if (type !== 'run') return;

  let suite: SuiteCheck[];
  try {
    const buildSuite = new Function('expect', suiteSource) as (expectFn: typeof expect) => SuiteCheck[];
    suite = buildSuite(expect);
    if (!Array.isArray(suite) || suite.some((check) =>
      !check || typeof check.name !== 'string' || typeof check.fn !== 'function'
    )) {
      throw new Error('Test suite must return an array of { name, fn } checks');
    }
  } catch (err) {
    self.postMessage({ type: 'error', requestId, error: err instanceof Error ? err.message : String(err) });
    return;
  }

  const checks: CheckResult[] = [];
  for (const check of suite) {
    try {
      await check.fn(message);
      checks.push({ name: check.name, pass: true });
    } catch (err) {
      checks.push({ name: check.name, pass: false, message: err instanceof Error ? err.message : String(err) });
    }
  }

  self.postMessage({ type: 'result', requestId, checks });
};
