import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkerResponse =
  | { type: 'result'; requestId: number; checks: { name: string; pass: boolean; message?: string }[] }
  | { type: 'error'; requestId: number; error: string };

describe('test-worker', () => {
  let postMessageMock: ReturnType<typeof vi.fn<(response: WorkerResponse) => void>>;

  beforeEach(async () => {
    postMessageMock = vi.fn();
    vi.stubGlobal('postMessage', postMessageMock);
    vi.resetModules();
    await import('./test-worker');
  });

  async function run(suiteSource: string, message: unknown, requestId = 1) {
    const handler = self.onmessage as unknown as (event: MessageEvent) => Promise<void>;
    await handler({ data: { type: 'run', requestId, suiteSource, message } } as MessageEvent);
  }

  function lastResponse(): WorkerResponse {
    const calls = postMessageMock.mock.calls;
    return calls[calls.length - 1][0];
  }

  it('reports a passing check', async () => {
    await run('return [{ name: "ok", fn: (m) => expect(m.content).toBeTruthy() }];', { content: 'hi' });
    expect(lastResponse()).toEqual({ type: 'result', requestId: 1, checks: [{ name: 'ok', pass: true }] });
  });

  it('reports a failing check with a descriptive message', async () => {
    await run('return [{ name: "fails", fn: (m) => expect(m.content).toBe("nope") }];', { content: 'hi' });
    const response = lastResponse();
    if (response.type !== 'result') throw new Error('expected a result response');
    expect(response.checks[0].pass).toBe(false);
    expect(response.checks[0].name).toBe('fails');
    expect(response.checks[0].message).toContain('to be');
  });

  it('runs multiple checks independently, one failure does not stop the rest', async () => {
    await run(
      `return [
        { name: 'a', fn: () => expect(1).toBe(1) },
        { name: 'b', fn: () => expect(1).toBe(2) },
        { name: 'c', fn: () => expect(1).toBe(1) },
      ];`,
      {},
    );
    const response = lastResponse();
    if (response.type !== 'result') throw new Error('expected a result response');
    expect(response.checks.map((c) => [c.name, c.pass])).toEqual([
      ['a', true],
      ['b', false],
      ['c', true],
    ]);
  });

  it('reports a suite build error for invalid syntax', async () => {
    await run('this is not valid js(', {});
    expect(lastResponse()).toMatchObject({ type: 'error', requestId: 1 });
  });

  it.each(['return null;', 'return {};', 'return [null];', 'return [{name: "bad"}];'])(
    'reports malformed suites immediately: %s', async (source) => {
      await run(source, {});
      expect(lastResponse()).toMatchObject({ type: 'error', error: expect.stringContaining('array of') });
    },
  );

  it('waits for asynchronous checks and reports rejections as failures', async () => {
    await run(`return [
      { name: 'async pass', fn: async () => { await Promise.resolve(); expect(1).toBe(1); } },
      { name: 'async fail', fn: async () => { await Promise.resolve(); expect(1).toBe(2); } },
    ];`, {});
    expect(lastResponse()).toMatchObject({ type: 'result', checks: [
      { name: 'async pass', pass: true }, { name: 'async fail', pass: false },
    ] });
  });

  const matrix: [string, string, boolean][] = [
    ['toBe pass', '() => expect(1).toBe(1)', true],
    ['toBe fail', '() => expect(1).toBe(2)', false],
    ['toEqual pass (deep)', '() => expect({ a: [1, 2] }).toEqual({ a: [1, 2] })', true],
    ['toEqual fail', '() => expect({ a: 1 }).toEqual({ a: 2 })', false],
    ['toContain array', '() => expect([1, 2, 3]).toContain(2)', true],
    ['toContain array miss', '() => expect([1, 2, 3]).toContain(9)', false],
    ['toContain string', '() => expect("hello world").toContain("world")', true],
    ['toMatch regex', '() => expect("hello").toMatch(/ell/)', true],
    ['toMatch string pattern', '() => expect("hello").toMatch("ell")', true],
    ['toMatch fail', '() => expect("hello").toMatch(/xyz/)', false],
    ['toBeTruthy pass', '() => expect(1).toBeTruthy()', true],
    ['toBeTruthy fail', '() => expect(0).toBeTruthy()', false],
    ['toBeFalsy pass', '() => expect(0).toBeFalsy()', true],
    ['toBeDefined pass', '() => expect(1).toBeDefined()', true],
    ['toBeDefined fail', '() => expect(undefined).toBeDefined()', false],
    ['toBeGreaterThan pass', '() => expect(5).toBeGreaterThan(3)', true],
    ['toBeGreaterThan fail', '() => expect(2).toBeGreaterThan(3)', false],
    ['toBeLessThan pass', '() => expect(2).toBeLessThan(3)', true],
    ['toBeLessThan fail', '() => expect(5).toBeLessThan(3)', false],
  ];

  it.each(matrix)('%s', async (_label, fn, expectedPass) => {
    await run(`return [{ name: 'check', fn: ${fn} }];`, {});
    const response = lastResponse();
    if (response.type !== 'result') throw new Error('expected a result response');
    expect(response.checks[0].pass).toBe(expectedPass);
  });
});
