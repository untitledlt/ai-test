import { Box, Flex, Text, Badge, IconButton, Checkbox, TextField, Select, Code, Tooltip, Spinner } from '@radix-ui/themes';
import { Brain, CheckCircle2, ChevronDown, XCircle, X } from 'lucide-react';
import type { BatchCallResult, BatchTask, CheckResult, ReasoningEffort } from '../types';
import { formatCost, formatDuration, formatTokens, formatVisionModelPrice } from '../lib/format';
import { formatToolCall } from '../lib/payload-utils';
import { ModelAutoComplete } from './model-autocomplete';
import { useChatModelOptions } from '../hooks/use-chat-models';
import { REASONING_EFFORT_OPTIONS } from '../lib/reasoning-effort';
import styles from './multiple-tasks-table.module.css';

const TASK_COLORS = ['indigo', 'green', 'amber', 'violet', 'cyan', 'pink'] as const;

export type TaskProgress = { done: number; total: number };

type MultipleTasksTableProps = {
  tasks: BatchTask[];
  resultsByTaskId: Record<string, BatchCallResult[]>;
  testResultsByTaskId: Record<string, Record<number, CheckResult[]>>;
  progressByTaskId: Record<string, TaskProgress | undefined>;
  isRunning: boolean;
  callCount: number;
  onTaskChange: (taskId: string, patch: Partial<BatchTask>) => void;
  onRemoveTask: (taskId: string) => void;
  /** Viewing a historical snapshot — disables all editing controls. */
  readOnly?: boolean;
  maxTokensLimit?: number;
};

export function MultipleTasksTable({
  tasks,
  resultsByTaskId,
  testResultsByTaskId,
  progressByTaskId,
  isRunning,
  callCount,
  onTaskChange,
  onRemoveTask,
  readOnly,
  maxTokensLimit,
}: MultipleTasksTableProps) {
  const controlsDisabled = isRunning || readOnly;
  const { optionsById: chatModelOptionsById } = useChatModelOptions();
  const chatModelIds = Array.from(chatModelOptionsById.keys());
  const chatModelPriceByValue = new Map(
    Array.from(chatModelOptionsById.entries()).map(([id, options]) => [id, formatVisionModelPrice(options)] as const),
  );
  const responseRowCount = Math.max(
    callCount,
    ...tasks.map((task) => resultsByTaskId[task.id]?.length ?? 0),
    0,
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
                      <Text weight="bold" style={{ color: `var(--${TASK_COLORS[index % TASK_COLORS.length]}-11)` }}>Task {index + 1}</Text>
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
                  suggestions={chatModelIds}
                  priceByValue={chatModelPriceByValue}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={styles.labelCol}>Temperature</td>
            {tasks.map((task) => (
              <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
                <TextField.Root
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={task.temperature}
                  onChange={(event) => onTaskChange(task.id, { temperature: Number(event.target.value) })}
                  disabled={controlsDisabled}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={styles.labelCol}>Reasoning effort</td>
            {tasks.map((task) => (
              <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
                <Select.Root
                  value={task.reasoningEffort ?? 'default'}
                  onValueChange={(value) =>
                    onTaskChange(task.id, {
                      reasoningEffort: value === 'default' ? undefined : (value as ReasoningEffort),
                    })
                  }
                  disabled={controlsDisabled || (chatModelOptionsById.get(task.model)?.supportsReasoning === false && !task.reasoningEffort)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    {REASONING_EFFORT_OPTIONS.map((option) => (
                      <Select.Item key={option.value} value={option.value} disabled={chatModelOptionsById.get(task.model)?.supportsReasoning === false && option.value !== 'default'}>
                        {option.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                {chatModelOptionsById.get(task.model)?.supportsReasoning === false && <Text size="1" color="gray">Reasoning unavailable.{task.reasoningEffort ? ' Choose Default or another model.' : ''}</Text>}
              </td>
            ))}
          </tr>
          <tr>
            <td className={styles.labelCol}>Max tokens</td>
            {tasks.map((task) => (
              <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
                <TextField.Root
                  type="number"
                  step="1"
                  min="1"
                  max={maxTokensLimit}
                  placeholder={maxTokensLimit ? `Default: ${maxTokensLimit}` : 'No limit'}
                  value={task.maxTokens == null ? '' : Math.min(task.maxTokens, maxTokensLimit ?? Infinity)}
                  onChange={(event) => {
                    const raw = event.target.value;
                    const parsed = raw === '' ? undefined : Math.min(maxTokensLimit ?? Infinity, Math.max(1, Math.round(Number(raw))));
                    onTaskChange(task.id, { maxTokens: parsed });
                  }}
                  disabled={controlsDisabled}
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
          <tr className={styles.summaryRow}>
            <td className={styles.labelCol}>Tests</td>
            {tasks.map((task) => {
              const testResults = testResultsByTaskId[task.id];
              const summary = summarizeTests(testResults);
              return (
                <td key={task.id} className={task.excluded ? styles.excludedCol : undefined}>
                  {summary ? (
                    <Badge color={summary.failed > 0 ? 'red' : 'green'} variant="soft">
                      {summary.passed}/{summary.passed + summary.failed} passed
                    </Badge>
                  ) : (
                    <Text color="gray">—</Text>
                  )}
                </td>
              );
            })}
          </tr>
          {Array.from({ length: responseRowCount }, (_, callIndex) => {
            const summary = summarizeTests({
              0: tasks.flatMap((task) => testResultsByTaskId[task.id]?.[callIndex] ?? []),
            });
            return (
            <tr key={callIndex}>
              <td className={styles.labelCol}>
                <Flex direction="column" align="start" gap="2">
                  <Text>Response #{callIndex + 1}</Text>
                  {summary && (
                    <Badge color={summary.failed > 0 ? 'red' : 'green'} variant="soft">
                      {summary.passed}/{summary.passed + summary.failed} passed
                    </Badge>
                  )}
                </Flex>
              </td>
              {tasks.map((task) => {
                const checks = testResultsByTaskId[task.id]?.[callIndex];
                const testStatus = checks?.length ? (checks.some((check) => !check.pass) ? 'failed' : 'passed') : undefined;
                return (
                <td key={task.id} data-test-status={testStatus} className={`${styles.responseCell} ${task.excluded ? styles.excludedCol : ''}`}>
                  <ResponseCell
                    pending={isRunning && !readOnly && !task.excluded && callIndex < (progressByTaskId[task.id]?.total ?? 0)}
                    result={resultsByTaskId[task.id]?.[callIndex]}
                    checks={checks}
                  />
                </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
}

function ResponseCell({ result, checks, pending }: { result?: BatchCallResult; checks?: CheckResult[]; pending?: boolean }) {
  if (!result && pending) return (
    <Flex align="center" gap="2" role="status" style={{ color: 'var(--accent-11)' }}>
      <Spinner size="1" />
      <Text size="2">Pending…</Text>
    </Flex>
  );
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

  const message = result.data.choices[0]?.message;
  const toolCalls = message?.tool_calls ?? [];

  return (
    <Flex direction="column" gap="1" className={`${styles.responseBody} ${message?.reasoning ? styles.withReasoning : ''}`}>
      {message?.reasoning && (
        <Tooltip content={message.reasoning} className={styles.reasoningTooltip}>
          <Box className={styles.reasoningIcon} width="fit-content">
            <Brain size={14} />
          </Box>
        </Tooltip>
      )}
      {message?.content && <Code className={styles.contentBlock} size="1">{message.content}</Code>}
      {toolCalls.map((call) => (
        <Code key={call.id} className={styles.contentBlock} size="1">
          {formatToolCall(call)}
        </Code>
      ))}
      {!message?.content && toolCalls.length === 0 && <Text color="gray">—</Text>}

      {checks && checks.length > 0 && (
        <div className={styles.checkResults} aria-label="Test results">
          {checks.map((check, index) =>
            check.pass ? (
              <div key={index} className={styles.checkPass}>
                <CheckCircle2 size={15} aria-label="Passed" />
                <Text size="1" weight="medium">{check.name}</Text>
              </div>
            ) : (
              <details key={index} className={styles.checkFail}>
                <summary>
                  <XCircle size={15} aria-label="Failed" />
                  <Text size="1" weight="medium">{check.name}</Text>
                  <ChevronDown size={14} className={styles.checkChevron} aria-hidden="true" />
                </summary>
                <Text as="p" size="1" className={styles.checkMessage}>
                  {check.message}
                </Text>
              </details>
            ),
          )}
        </div>
      )}
    </Flex>
  );
}

function computeTaskStats(results: BatchCallResult[]) {
  const settled = results.filter((result): result is BatchCallResult => result != null);
  const successful = settled.filter((result): result is Extract<BatchCallResult, { success: true }> => result.success);
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

function summarizeTests(testResults: Record<number, CheckResult[]> | undefined): { passed: number; failed: number } | null {
  if (!testResults) return null;
  const allChecks = Object.values(testResults).flat();
  if (allChecks.length === 0) return null;
  return {
    passed: allChecks.filter((check) => check.pass).length,
    failed: allChecks.filter((check) => !check.pass).length,
  };
}
