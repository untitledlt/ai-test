import { Flex, Text, Select } from '@radix-ui/themes';
import { BatchRunControls } from './batch-run-controls';
import { formatDateTime } from '../lib/format';
import type { MultipleResultsSnapshot } from '../types';
import type { BatchPacingControlsProps } from './batch-pacing-controls';

type MultipleToolbarProps = {
  callCount: number;
  onCallCountChange: (count: number) => void;
  onAddTask: () => void;
  onStart: () => void;
  isRunning: boolean;
  startDisabled?: boolean;
  maxCallCount?: number;
  addTaskDisabled?: boolean;
  pacing?: BatchPacingControlsProps;
  history: MultipleResultsSnapshot[];
  historySelection: string;
  onHistorySelectionChange: (value: string) => void;
};

export function MultipleToolbar({
  callCount,
  onCallCountChange,
  onAddTask,
  onStart,
  isRunning,
  startDisabled,
  maxCallCount,
  addTaskDisabled,
  pacing,
  history,
  historySelection,
  onHistorySelectionChange,
}: MultipleToolbarProps) {
  return (
    <BatchRunControls
      callCount={callCount}
      onCallCountChange={onCallCountChange}
      callCountLabel="Calls per task"
      onAddTask={onAddTask}
      onStart={onStart}
      isRunning={isRunning}
      startDisabled={startDisabled}
      maxCallCount={maxCallCount}
      addTaskDisabled={addTaskDisabled}
      pacing={pacing}
    >
      {history.length > 0 && (
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            Results
          </Text>
          <Select.Root value={historySelection} onValueChange={onHistorySelectionChange}>
            <Select.Trigger variant="surface" color="gray" style={{ minWidth: 200 }} />
            <Select.Content>
              <Select.Item value="live">Live results</Select.Item>
              {history.map((snapshot, index) => (
                <Select.Item key={snapshot.id} value={snapshot.id}>
                  {formatDateTime(snapshot.createdAt)}
                  {index === 0 ? ' (latest run)' : ''}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
      )}
    </BatchRunControls>
  );
}
