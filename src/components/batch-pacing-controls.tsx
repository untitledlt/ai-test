import { Flex, IconButton, Select, Text, Tooltip } from '@radix-ui/themes';
import { Info } from 'lucide-react';
import type { BatchPacing } from '../hooks/use-batch-pacing';

export type BatchPacingControlsProps = {
  value: BatchPacing;
  onChange: (value: BatchPacing) => void;
  disabled?: boolean;
};

export function BatchPacingControls({ value, onChange, disabled }: BatchPacingControlsProps) {
  return (
    <>
      <Flex direction="column" gap="1">
        <Flex align="center" gap="2">
          <Text size="1" color="gray">Start interval</Text>
          <Tooltip content="Minimum time between request starts across all models in this batch. Upstream rate limits can still occur.">
            <IconButton type="button" size="1" variant="ghost" color="gray" aria-label="About start interval">
              <Info size={12} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        </Flex>
        <Select.Root value={String(value.startIntervalMs)} disabled={disabled}
          onValueChange={(interval) => onChange({ ...value, startIntervalMs: Number(interval) })}>
          <Select.Trigger aria-label="Start interval" />
          <Select.Content>
            {[0, 500, 1000, 2000, 5000, 10000, 30000, 60000].map((interval) => (
              <Select.Item key={interval} value={String(interval)}>{interval === 0 ? 'No delay' : `${interval / 1000} s`}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>
      <Flex direction="column" gap="1">
        <Text size="1" color="gray">Concurrency</Text>
        <Select.Root value={String(value.concurrency)} disabled={disabled}
          onValueChange={(concurrency) => onChange({ ...value, concurrency: Number(concurrency) })}>
          <Select.Trigger aria-label="Concurrency" />
          <Select.Content>
            {[1, 2, 3, 4, 5].map((count) => <Select.Item key={count} value={String(count)}>{count}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      </Flex>
    </>
  );
}
