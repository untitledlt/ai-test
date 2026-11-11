import type { AgentRecord } from '../db/types';
import type { BatchTask, MultipleResultsSnapshot, MultipleResultsState } from '../types';
import { DEFAULT_MODEL } from './models';
import { randomUUID } from './uuid';

export const DEFAULT_TEST_SUITE = `return [
  {
    name: 'has content or tool_calls',
    fn: (message) => expect(message.content || message.tool_calls).toBeTruthy(),
  },
];
`;

export function createDefaultTask(): BatchTask {
  return { id: randomUUID(), model: DEFAULT_MODEL, temperature: 0.7, excluded: false };
}

export type MultipleCallConfig = {
  tasks: BatchTask[];
  callCount: number;
  testSuite: string;
  history: MultipleResultsSnapshot[];
};

/**
 * Reads the current multi-call fields off a record, falling back to migrating the legacy
 * single-snapshot `multipleResults` JSON string (pre-history schema) into one history entry.
 */
export function migrateLegacyRecord(record: AgentRecord): MultipleCallConfig {
  if (record.multipleTasks || record.multipleResultsHistory) {
    return {
      tasks: record.multipleTasks ?? [createDefaultTask()],
      callCount: record.multipleCallCount ?? 1,
      testSuite: record.multipleTestSuite ?? DEFAULT_TEST_SUITE,
      history: record.multipleResultsHistory ?? [],
    };
  }

  if (record.multipleResults) {
    try {
      const parsed: unknown = JSON.parse(record.multipleResults);
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as MultipleResultsState).tasks) &&
        Array.isArray((parsed as MultipleResultsState).results)
      ) {
        const legacy = parsed as MultipleResultsState;
        const tasks = legacy.tasks.map((task) => ({ ...task, id: task.id ?? randomUUID() }));
        const snapshot: MultipleResultsSnapshot = {
          id: randomUUID(),
          createdAt: record.updatedAt,
          tasks,
          callCount: typeof legacy.callCount === 'number' ? legacy.callCount : 1,
          results: legacy.results,
        };
        return {
          tasks,
          callCount: snapshot.callCount,
          testSuite: typeof legacy.testSuite === 'string' ? legacy.testSuite : DEFAULT_TEST_SUITE,
          history: [snapshot],
        };
      }
    } catch {
      // fall through to defaults below
    }
  }

  return { tasks: [createDefaultTask()], callCount: 1, testSuite: DEFAULT_TEST_SUITE, history: [] };
}
