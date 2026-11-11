import { Box, Flex, Text, Badge, IconButton, Checkbox, Select } from '@radix-ui/themes';
import { X } from 'lucide-react';
import type { ImageGenCallResult } from '../types';
import { formatCost, formatDuration, formatTokens } from '../lib/format';
import type { ImageGenTask } from '../lib/image-gen-utils';
import { useImageModelOptions, useImageModelPrices } from '../hooks/use-image-models';
import { ModelAutoComplete } from './model-autocomplete';
import { ZoomableImage } from './zoomable-image';
import type { TaskProgress } from './multiple-tasks-table';
import { formatImageModelPrice } from '../lib/format';
import tableStyles from './multiple-tasks-table.module.css';
import styles from './image-gen-tasks-table.module.css';

const TASK_COLORS = ['indigo', 'green', 'amber', 'violet', 'cyan', 'pink'] as const;

type ImageGenTasksTableProps = {
  tasks: ImageGenTask[];
  resultsByTaskId: Record<string, ImageGenCallResult[]>;
  progressByTaskId: Record<string, TaskProgress | undefined>;
  isRunning: boolean;
  callCount: number;
  onTaskChange: (taskId: string, patch: Partial<ImageGenTask>) => void;
  onRemoveTask: (taskId: string) => void;
};

export function ImageGenTasksTable({
  tasks,
  resultsByTaskId,
  progressByTaskId,
  isRunning,
  callCount,
  onTaskChange,
  onRemoveTask,
}: ImageGenTasksTableProps) {
  const controlsDisabled = isRunning;
  const responseRowCount = Math.max(callCount, ...tasks.map((task) => resultsByTaskId[task.id]?.length ?? 0), 0);
  const { optionsById } = useImageModelOptions();
  const { priceById } = useImageModelPrices();
  const modelIds = Array.from(optionsById.keys());
  const priceLabelByModelId = new Map(
    Array.from(priceById.entries())
      .map(([id, price]) => [id, formatImageModelPrice(price)] as const)
      .filter((entry): entry is [string, string] => entry[1] != null),
  );

  return (
    <Box className={tableStyles.wrapper}>
      <table className={tableStyles.table} style={{ minWidth: 150 + tasks.length * 220 }}>
        <thead>
          <tr>
            <th className={`${tableStyles.labelCol} ${tableStyles.headerCell}`} />
            {tasks.map((task, index) => {
              const progress = progressByTaskId[task.id];
              return (
                <th
                  key={task.id}
                  className={`${tableStyles.headerCell} ${task.excluded ? tableStyles.excludedCol : ''}`}
                  style={{ boxShadow: `inset 0 3px 0 var(--${TASK_COLORS[index % TASK_COLORS.length]}-9)` }}
                >
                  <Flex direction="column" gap="1" align="center">
                    <Flex align="center" gap="2">
                      <Text weight="bold" style={{ color: `var(--${TASK_COLORS[index % TASK_COLORS.length]}-11)` }}>
                        Task {index + 1}
                      </Text>
                      <IconButton
                        size="1"
                        variant="ghost"
                        color="red"
                        disabled={controlsDisabled}
                        onClick={() => onRemoveTask(task.id)}
                        aria-label={`Remove task ${index + 1}`}
                      >
                        <X size={14} />
                      </IconButton>
                    </Flex>
                    <Flex gap="1">
                      {task.excluded && <Badge color="gray">Excluded</Badge>}
                      {isRunning && progress && (
                        <Badge color="blue">
                          {progress.done}/{progress.total}
                        </Badge>
                      )}
                    </Flex>
                  </Flex>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tableStyles.labelCol}>Exclude</td>
            {tasks.map((task) => (
              <td key={task.id} className={task.excluded ? tableStyles.excludedCol : undefined}>
                <Checkbox
                  checked={task.excluded ?? false}
                  disabled={controlsDisabled}
                  onCheckedChange={(checked) => onTaskChange(task.id, { excluded: checked === true })}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={tableStyles.labelCol}>Model</td>
            {tasks.map((task) => (
              <td key={task.id} className={task.excluded ? tableStyles.excludedCol : undefined}>
                <ModelAutoComplete
                  value={task.model}
                  onChange={(model) => onTaskChange(task.id, { model })}
                  disabled={controlsDisabled}
                  suggestions={modelIds}
                  priceByValue={priceLabelByModelId}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={tableStyles.labelCol}>Aspect ratio</td>
            {tasks.map((task) => {
              const aspectRatios = optionsById.get(task.model)?.aspectRatios ?? [];
              return (
                <td key={task.id} className={task.excluded ? tableStyles.excludedCol : undefined}>
                  <Select.Root
                    value={task.aspectRatio ?? 'auto'}
                    onValueChange={(value) =>
                      onTaskChange(task.id, { aspectRatio: value === 'auto' ? undefined : value })
                    }
                    disabled={controlsDisabled || aspectRatios.length === 0}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="auto">Auto</Select.Item>
                      {aspectRatios.map((value) => (
                        <Select.Item key={value} value={value}>
                          {value}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </td>
              );
            })}
          </tr>
          <tr>
            <td className={tableStyles.labelCol}>Resolution</td>
            {tasks.map((task) => {
              const resolutions = optionsById.get(task.model)?.resolutions ?? [];
              return (
                <td key={task.id} className={task.excluded ? tableStyles.excludedCol : undefined}>
                  <Select.Root
                    value={task.resolution ?? 'auto'}
                    onValueChange={(value) =>
                      onTaskChange(task.id, { resolution: value === 'auto' ? undefined : value })
                    }
                    disabled={controlsDisabled || resolutions.length === 0}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="auto">Auto</Select.Item>
                      {resolutions.map((value) => (
                        <Select.Item key={value} value={value}>
                          {value}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </td>
              );
            })}
          </tr>
          {(['Avg tokens / call', 'Avg price / call', 'Avg time / call'] as const).map((label) => (
            <tr key={label} className={tableStyles.summaryRow}>
              <td className={tableStyles.labelCol}>{label}</td>
              {tasks.map((task) => {
                const stats = computeTaskStats(resultsByTaskId[task.id] ?? []);
                return (
                  <td key={task.id} className={task.excluded ? tableStyles.excludedCol : undefined}>
                    {label === 'Avg tokens / call' && (stats.avgTokens != null ? formatTokens(stats.avgTokens) : '—')}
                    {label === 'Avg price / call' && formatCost(stats.avgCost)}
                    {label === 'Avg time / call' && (stats.avgDuration != null ? formatDuration(stats.avgDuration) : '—')}
                  </td>
                );
              })}
            </tr>
          ))}
          {Array.from({ length: responseRowCount }, (_, callIndex) => (
            <tr key={callIndex}>
              <td className={tableStyles.labelCol}>Response #{callIndex + 1}</td>
              {tasks.map((task) => (
                <td key={task.id} className={task.excluded ? tableStyles.excludedCol : undefined}>
                  <ImageGenResponseCell result={resultsByTaskId[task.id]?.[callIndex]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function ImageGenResponseCell({ result }: { result?: ImageGenCallResult }) {
  if (!result) return <Text color="gray">—</Text>;

  if (!result.success) {
    return (
      <Box className={tableStyles.errorBlock}>
        <Text size="1" color="red">
          {result.error}
        </Text>
      </Box>
    );
  }

  if (result.data.images.length === 0) return <Text color="gray">—</Text>;

  return (
    <Flex direction="column" gap="2">
      {result.data.images.map((image, index) => (
        <ZoomableImage key={index} src={image.dataUrl} alt="Generated image" className={styles.thumbnail} />
      ))}
    </Flex>
  );
}

function computeTaskStats(results: ImageGenCallResult[]) {
  const settled = results.filter((result): result is ImageGenCallResult => result != null);
  const successful = settled.filter((result): result is Extract<ImageGenCallResult, { success: true }> => result.success);
  const avgTokens =
    successful.length > 0
      ? successful.reduce((sum, result) => sum + result.data.usage.total_tokens, 0) / successful.length
      : null;
  const withCost = successful.filter((result) => result.data.usage.cost != null);
  const avgCost =
    withCost.length > 0
      ? withCost.reduce((sum, result) => sum + (result.data.usage.cost ?? 0), 0) / withCost.length
      : null;
  const avgDuration =
    settled.length > 0 ? settled.reduce((sum, result) => sum + result.durationMs, 0) / settled.length : null;
  return { avgTokens, avgCost, avgDuration };
}
