import { Box, Flex, Text, Badge, IconButton, Checkbox, Code } from '@radix-ui/themes';
import { X } from 'lucide-react';
import type { DecisionCallResult } from '../types';
import { formatCost, formatDuration, formatTokens, formatVisionModelPrice } from '../lib/format';
import { formatDecisionAnswer } from '../lib/decision-utils';
import type { DecisionTask } from '../lib/decision-utils';
import { useDecisionModelOptions } from '../hooks/use-decision-models';
import { ModelAutoComplete } from './model-autocomplete';
import type { TaskProgress } from './multiple-tasks-table';
import styles from './multiple-tasks-table.module.css';

const TASK_COLORS = ['indigo', 'green', 'amber', 'violet', 'cyan', 'pink'] as const;

type DecisionTasksTableProps = {
  tasks: DecisionTask[];
  resultsByTaskId: Record<string, DecisionCallResult[]>;
  progressByTaskId: Record<string, TaskProgress | undefined>;
  isRunning: boolean;
  callCount: number;
  onTaskChange: (taskId: string, patch: Partial<DecisionTask>) => void;
  onRemoveTask: (taskId: string) => void;
  /** Viewing a historical snapshot — disables all editing controls. */
  readOnly?: boolean;
};

export function DecisionTasksTable({
  tasks,
  resultsByTaskId,
  progressByTaskId,
  isRunning,
  callCount,
  onTaskChange,
  onRemoveTask,
  readOnly,
}: DecisionTasksTableProps) {
  const controlsDisabled = isRunning || readOnly;
  const responseRowCount = Math.max(callCount, ...tasks.map((task) => resultsByTaskId[task.id]?.length ?? 0), 0);
  const { optionsById: decisionModelOptionsById } = useDecisionModelOptions();
  const decisionModelIds = Array.from(decisionModelOptionsById.keys());
  const decisionModelPriceByValue = new Map(
    Array.from(decisionModelOptionsById.entries()).map(([id, options]) => [id, formatVisionModelPrice(options)] as const),
  );

  return (
    <Box className={styles.wrapper}>
      <table className={styles.table} style={{ minWidth: 150 + tasks.length * 220 }}>
        <thead>
          <tr>
            <th className={`${styles.labelCol} ${styles.headerCell}`} />
            {tasks.map((task, index) => {
              const progress = progressByTaskId[task.id];
              return (
                <th
                  key={task.id}
                  className={`${styles.headerCell} ${task.excluded ? styles.excludedCol : ''}`}
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
            <td className={styles.labelCol}>Exclude</td>
            {tasks.map((task) => (
              <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
                <Checkbox
                  checked={task.excluded ?? false}
                  disabled={controlsDisabled}
                  onCheckedChange={(checked) => onTaskChange(task.id, { excluded: checked === true })}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={styles.labelCol}>Model</td>
            {tasks.map((task) => (
              <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
                <ModelAutoComplete
                  value={task.model}
                  onChange={(model) => onTaskChange(task.id, { model })}
                  disabled={controlsDisabled}
                  suggestions={decisionModelIds}
                  priceByValue={decisionModelPriceByValue}
                />
              </td>
            ))}
          </tr>
          {(['Avg tokens / call', 'Avg price / call', 'Avg time / call'] as const).map((label) => (
            <tr key={label} className={styles.summaryRow}>
              <td className={styles.labelCol}>{label}</td>
              {tasks.map((task) => {
                const stats = computeTaskStats(resultsByTaskId[task.id] ?? []);
                return (
                  <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
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
              <td className={styles.labelCol}>Response #{callIndex + 1}</td>
              {tasks.map((task) => (
                <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
                  <DecisionResponseCell result={resultsByTaskId[task.id]?.[callIndex]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function DecisionResponseCell({ result }: { result?: DecisionCallResult }) {
  if (!result) return <Text color="gray">—</Text>;

  if (!result.success) {
    return (
      <Box className={styles.errorBlock}>
        <Text size="1" color="red">
          {result.error}
        </Text>
      </Box>
    );
  }

  const entries = Object.entries(result.data.answers);
  if (entries.length === 0) return <Text color="gray">—</Text>;

  const text = entries.map(([name, answer]) => formatDecisionAnswer(name, answer)).join('\n');
  return (
    <Code className={styles.contentBlock} size="1">
      {text}
    </Code>
  );
}

function computeTaskStats(results: DecisionCallResult[]) {
  const settled = results.filter((result): result is DecisionCallResult => result != null);
  const successful = settled.filter((result): result is Extract<DecisionCallResult, { success: true }> => result.success);
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
