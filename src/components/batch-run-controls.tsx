import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Flex, Text, TextField } from '@radix-ui/themes';
import { Play, Plus } from 'lucide-react';
import { BatchPacingControls } from './batch-pacing-controls';
import type { BatchPacingControlsProps } from './batch-pacing-controls';

type BatchRunControlsProps = {
  callCount: number;
  onCallCountChange: (count: number) => void;
  onStart: () => void;
  isRunning: boolean;
  startDisabled?: boolean;
  callCountLabel?: string;
  onAddTask?: () => void;
  children?: ReactNode;
  maxCallCount?: number;
  addTaskDisabled?: boolean;
  pacing?: BatchPacingControlsProps;
};

export function BatchRunControls({
  callCount, onCallCountChange, onStart, isRunning, startDisabled,
  callCountLabel = 'Calls per model', onAddTask, children, maxCallCount = 20, addTaskDisabled, pacing,
}: BatchRunControlsProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(() => ({ count: callCount, text: String(callCount) }));
  // A loaded/reset record can change the count independently of this input.
  if (draft.count !== callCount) {
    setDraft({ count: callCount, text: String(callCount) });
  }

  return (
    <Flex align="end" gap="3" wrap="wrap" flexGrow="1">
      <Flex direction="column" gap="1">
        <Text as="label" htmlFor={inputId} size="1" color="gray">{callCountLabel}</Text>
        <TextField.Root
          id={inputId}
          type="number"
          min="1"
          max={maxCallCount}
          style={{ width: 88 }}
          value={draft.text}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft({ count: callCount, text: raw });
            const parsed = Number(raw);
            // Preserve an empty field while editing; only valid numbers change the run count.
            if (raw !== '' && Number.isFinite(parsed)) {
              onCallCountChange(Math.min(maxCallCount, Math.max(1, Math.round(parsed))));
            }
          }}
          onBlur={() => setDraft({ count: callCount, text: String(callCount) })}
          disabled={isRunning}
        />
      </Flex>
      {pacing && <BatchPacingControls {...pacing} disabled={isRunning} />}
      {onAddTask && (
        <Button variant="outline" color="gray" onClick={onAddTask} disabled={isRunning || addTaskDisabled}>
          <Plus size={14} /> Add task
        </Button>
      )}
      <Flex flexGrow="1" />
      {children}
      <Button onClick={onStart} disabled={isRunning || startDisabled} loading={isRunning}>
        <Play size={14} /> Start
      </Button>
    </Flex>
  );
}
