import { useBatchPacing } from '../hooks/use-batch-pacing';
import { DEMO_MAX_OUTPUT_TOKENS } from '../lib/run-limits';
import { useRunGuard } from '../hooks/use-run-guard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, SegmentedControl, Text, Flex, Callout, Button, TextField, Select } from '@radix-ui/themes';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/confirm-dialog';
import { ProviderWarning } from '../components/provider-warning';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { Toolbar } from '../components/toolbar';
import { JsonEditor, useResizableHeight } from '@untitled/ui-kit';
import { SubmitLoadingOverlay } from '../components/submit-loading-overlay';
import { FormEditor } from '../components/form-editor';
import { ResultPanel } from '../components/result-panel';
import { SaveAsDialog } from '../components/save-as-dialog';
import { ModelAutoComplete } from '../components/model-autocomplete';
import { useChatModelOptions } from '../hooks/use-chat-models';
import { formatVisionModelPrice } from '../lib/format';
import { MultipleToolbar } from '../components/multiple-toolbar';
import { MultipleTasksTable } from '../components/multiple-tasks-table';
import type { TaskProgress } from '../components/multiple-tasks-table';
import { BottomPanel } from '../components/bottom-panel';
import { useRecord, useCreateRecord, useUpdateRecord } from '../hooks/use-records';
import { useCompletion } from '../hooks/use-completion';
import { useActiveProvider } from '../hooks/use-providers';
import { parsePayload, buildAppendMessagesFromChoice } from '../lib/payload-utils';
import { submitCompletion } from '../lib/openrouter-client';
import { runWithConcurrency } from '../lib/batch-runner';
import { TestRunner } from '../lib/test-runner';
import type { TestJob } from '../lib/test-runner';
import { DEFAULT_MODEL } from '../lib/models';
import { createDefaultTask, DEFAULT_TEST_SUITE, migrateLegacyRecord } from '../lib/multiple-call-utils';
import { REASONING_EFFORT_OPTIONS } from '../lib/reasoning-effort';
import { randomUUID } from '../lib/uuid';
import type {
  AiTestAgentPayload,
  AiTestAgentResult,
  BatchCallResult,
  BatchTask,
  CheckResult,
  MultipleResultsSnapshot,
  ReasoningEffort,
} from '../types';
import styles from './record-page.module.css';

const BLANK_CONTENT = JSON.stringify({ messages: [] }, null, 2);
const MODE_STORAGE_KEY = 'ai-test-agent:editor-mode';
const MODEL_STORAGE_KEY = 'ai-test-agent:last-model';
const TEMPERATURE_STORAGE_KEY = 'ai-test-agent:last-temperature';
const REASONING_EFFORT_STORAGE_KEY = 'ai-test-agent:last-reasoning-effort';
const MAX_TOKENS_STORAGE_KEY = 'ai-test-agent:last-max-tokens';

function loadStoredMode(): 'editor' | 'form' {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  return stored === 'editor' ? 'editor' : 'form';
}

function loadStoredModel(): string {
  return localStorage.getItem(MODEL_STORAGE_KEY) ?? DEFAULT_MODEL;
}

function loadStoredTemperature(): number {
  const stored = Number(localStorage.getItem(TEMPERATURE_STORAGE_KEY));
  return Number.isFinite(stored) && stored >= 0 && stored <= 2 ? stored : 0.7;
}

function loadStoredReasoningEffort(): ReasoningEffort | undefined {
  const stored = localStorage.getItem(REASONING_EFFORT_STORAGE_KEY);
  return stored ? (stored as ReasoningEffort) : undefined;
}

function loadStoredMaxTokens(): number | undefined {
  const stored = Number(localStorage.getItem(MAX_TOKENS_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? Math.round(stored) : undefined;
}

type SavedSnapshot = { name: string; content: string; tasksJson: string; callCount: number; testSuite: string };

function blankSavedSnapshot(defaultTask: BatchTask): SavedSnapshot {
  return { name: '', content: BLANK_CONTENT, tasksJson: JSON.stringify([defaultTask]), callCount: 1, testSuite: DEFAULT_TEST_SUITE };
}

export function RecordPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordQuery = useRecord(recordId);
  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const completion = useCompletion();
  const { activeProvider } = useActiveProvider();
  const runGuard = useRunGuard(activeProvider);
  const pacing = useBatchPacing(runGuard.demo);

  const [tab, setTab] = useState<'single' | 'multiple'>(() => (searchParams.get('tab') === 'multiple' ? 'multiple' : 'single'));

  // Single-call state
  const [name, setName] = useState('');
  const [content, setContent] = useState(BLANK_CONTENT);
  const [mode, setMode] = useState<'editor' | 'form'>(loadStoredMode);
  const [model, setModel] = useState(loadStoredModel);
  const [temperature, setTemperature] = useState(loadStoredTemperature);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | undefined>(loadStoredReasoningEffort);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(loadStoredMaxTokens);
  const { optionsById: chatModelOptionsById } = useChatModelOptions();
  const reasoningUnsupported = chatModelOptionsById.get(model)?.supportsReasoning === false;
  const chatModelIds = Array.from(chatModelOptionsById.keys());
  const chatModelPriceByValue = new Map(
    Array.from(chatModelOptionsById.entries()).map(([id, options]) => [id, formatVisionModelPrice(options)] as const),
  );
  const [result, setResult] = useState<AiTestAgentResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState<AiTestAgentPayload | null>(null);

  // Multiple-call state
  const [initialTask] = useState(createDefaultTask);
  const [tasks, setTasks] = useState<BatchTask[]>(() => [initialTask]);
  const [callCount, setCallCount] = useState(1);
  const [testSuite, setTestSuite] = useState(DEFAULT_TEST_SUITE);
  const [resultsByTaskId, setResultsByTaskId] = useState<Record<string, BatchCallResult[]>>({});
  const [testResultsByTaskId, setTestResultsByTaskId] = useState<Record<string, Record<number, CheckResult[]>>>({});
  const [progressByTaskId, setProgressByTaskId] = useState<Record<string, TaskProgress | undefined>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [history, setHistory] = useState<MultipleResultsSnapshot[]>([]);
  const [historySelection, setHistorySelection] = useState('live');

  const testRunnerRef = useRef<TestRunner | null>(null);
  const { height, startDrag } = useResizableHeight(320, { min: 160, grow: 'up' });

  const lastSaved = useRef<SavedSnapshot>(blankSavedSnapshot(initialTask));
  const isDirtyRef = useRef(false);
  const loadedForRecordId = useRef<string | undefined>(undefined);

  useEffect(() => {
    return () => testRunnerRef.current?.terminate();
  }, []);

  function resetToBlank() {
    const defaultTask = createDefaultTask();
    setName('');
    setContent(BLANK_CONTENT);
    setResult(null);
    setRequestError(null);
    setDurationMs(null);
    setTasks([defaultTask]);
    setCallCount(1);
    setTestSuite(DEFAULT_TEST_SUITE);
    setHistory([]);
    setHistorySelection('live');
    setResultsByTaskId({});
    setTestResultsByTaskId({});
    setProgressByTaskId({});
    lastSaved.current = blankSavedSnapshot(defaultTask);
    isDirtyRef.current = false;
  }

  useEffect(() => {
    if (recordId && recordQuery.data && loadedForRecordId.current !== recordId) {
      loadedForRecordId.current = recordId;
      const record = recordQuery.data;
      setName(record.name);
      setContent(record.content);
      setResult(null);
      setRequestError(null);
      setDurationMs(null);

      const migrated = migrateLegacyRecord(record);
      setTasks(migrated.tasks);
      setCallCount(migrated.callCount);
      setTestSuite(migrated.testSuite);
      setHistory(migrated.history);
      setHistorySelection('live');
      setTestResultsByTaskId({});
      setProgressByTaskId({});

      const latest = migrated.history[0];
      const liveResults: Record<string, BatchCallResult[]> = {};
      if (latest) {
        latest.tasks.forEach((task, index) => {
          liveResults[task.id] = latest.results[index] ?? [];
        });
      }
      setResultsByTaskId(liveResults);

      lastSaved.current = {
        name: record.name,
        content: record.content,
        tasksJson: JSON.stringify(migrated.tasks),
        callCount: migrated.callCount,
        testSuite: migrated.testSuite,
      };
      isDirtyRef.current = false;
    }
    if (!recordId && loadedForRecordId.current !== undefined) {
      loadedForRecordId.current = undefined;
      resetToBlank();
    }
  }, [recordId, recordQuery.data]);

  useEffect(() => {
    isDirtyRef.current =
      name !== lastSaved.current.name ||
      content !== lastSaved.current.content ||
      JSON.stringify(tasks) !== lastSaved.current.tasksJson ||
      callCount !== lastSaved.current.callCount ||
      testSuite !== lastSaved.current.testSuite;
  });

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem(TEMPERATURE_STORAGE_KEY, String(temperature));
  }, [temperature]);

  useEffect(() => {
    if (reasoningEffort) localStorage.setItem(REASONING_EFFORT_STORAGE_KEY, reasoningEffort);
    else localStorage.removeItem(REASONING_EFFORT_STORAGE_KEY);
  }, [reasoningEffort]);

  useEffect(() => {
    if (maxTokens != null) localStorage.setItem(MAX_TOKENS_STORAGE_KEY, String(maxTokens));
    else localStorage.removeItem(MAX_TOKENS_STORAGE_KEY);
  }, [maxTokens]);

  const { guardedAction, discardDialogProps } = useUnsavedChanges(isDirtyRef);

  function handleNew() {
    guardedAction(() => {
      if (recordId) navigate('/agent');
      else resetToBlank();
    });
  }

  function handleTabChange(value: 'single' | 'multiple') {
    // Plain local state — intentionally does not go through react-router navigation
    // (setSearchParams) so the unsaved-changes blocker never sees a tab switch as
    // "leaving the page" and preserves in-memory state either way.
    setTab(value);
  }

  function handleSave() {
    const parsed = parsePayload(content);
    if (!parsed) {
      toast.error('Payload is not valid JSON or has an invalid message/tool structure');
      return;
    }
    const multiplePatch = {
      multipleTasks: tasks,
      multipleCallCount: callCount,
      multipleTestSuite: testSuite,
      multipleResultsHistory: history,
    };
    if (recordId && recordQuery.data) {
      updateRecord.mutate(
        { ...recordQuery.data, name, content, ...multiplePatch },
        {
          onSuccess: () => {
            lastSaved.current = { name, content, tasksJson: JSON.stringify(tasks), callCount, testSuite };
            isDirtyRef.current = false;
            toast.success('Saved');
          },
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      setSaveAsOpen(true);
    }
  }

  function handleSaveAsConfirm(newName: string) {
    const parsed = parsePayload(content);
    if (!parsed) {
      toast.error('Payload is not valid JSON or has an invalid message/tool structure');
      return;
    }
    createRecord.mutate(
      {
        name: newName,
        content,
        multipleTasks: tasks,
        multipleCallCount: callCount,
        multipleTestSuite: testSuite,
        multipleResultsHistory: history,
      },
      {
        onSuccess: (doc) => {
          setName(newName);
          lastSaved.current = { name: newName, content, tasksJson: JSON.stringify(tasks), callCount, testSuite };
          isDirtyRef.current = false;
          navigate(tab === 'multiple' ? `/agent/${doc._id}?tab=multiple` : `/agent/${doc._id}`, { replace: true });
          toast.success('Saved');
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  async function performSubmit(messages: AiTestAgentPayload['messages'], tools: AiTestAgentPayload['tools']) {
    if (!activeProvider?.apiKey || !model.trim() || completion.isPending) return;
    if (!await runGuard.approve({ taskCount: 1, activeTaskCount: 1, callCount: 1,
      payloads: [{ model, messages, tools, temperature, reasoningEffort, maxTokens }] })) return;
    const start = performance.now();
    setRequestError(null);
    setResult(null);
    completion.mutate(
      { model, messages, tools, temperature, reasoningEffort, maxTokens },
      {
        onSuccess: (data) => {
          setResult(data);
          setDurationMs(performance.now() - start);
        },
        onError: (err) => {
          setRequestError(err.message);
          toast.error(err.message);
        },
        onSettled: runGuard.finish,
      },
    );
  }

  function handleSubmit() {
    if (!model.trim()) return;
    const parsed = parsePayload(content);
    if (!parsed) {
      toast.error('Payload is not valid JSON or has an invalid message/tool structure');
      return;
    }
    const lastMessage = parsed.messages[parsed.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      setPendingSubmitPayload(parsed);
      return;
    }
    performSubmit(parsed.messages, parsed.tools);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (tab !== 'single') return;
        if (!activeProvider?.apiKey || !model.trim() || completion.isPending) return;
        handleSubmit();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (updateRecord.isPending || createRecord.isPending) return;
        handleSave();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  function handleAppendToMessages() {
    if (!result) return;
    const parsed = parsePayload(content);
    if (!parsed) return;
    const appended = buildAppendMessagesFromChoice(result.choices[0]);
    const next = { ...parsed, messages: [...parsed.messages, ...appended] };
    setContent(JSON.stringify(next, null, 2));
  }

  function handleCopyJson() {
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success('Copied JSON to clipboard'))
      .catch(() => toast.error('Failed to copy'));
  }

  function handleClear() {
    setContent('{}');
  }

  function handleTaskChange(taskId: string, patch: Partial<BatchTask>) {
    setHistorySelection('live');
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }

  function handleAddTask() {
    if (tasks.length >= runGuard.maxTasks) return;
    setHistorySelection('live');
    setTasks((prev) => [...prev, createDefaultTask()]);
  }

  function handleRemoveTask(taskId: string) {
    setHistorySelection('live');
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setResultsByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setTestResultsByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  function handleCallCountChange(count: number) {
    setHistorySelection('live');
    setCallCount(count);
  }

  function persistRun(record: NonNullable<typeof recordQuery.data>, finalResults: Record<string, BatchCallResult[]>) {
    const snapshot: MultipleResultsSnapshot = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      tasks,
      callCount,
      results: tasks.map((task) => finalResults[task.id] ?? []),
    };
    const nextHistory = [snapshot, ...history];
    setHistory(nextHistory);
    updateRecord.mutate(
      {
        ...record,
        name,
        content,
        multipleTasks: tasks,
        multipleCallCount: callCount,
        multipleTestSuite: testSuite,
        multipleResultsHistory: nextHistory,
      },
      { onError: (err) => toast.error(err.message) },
    );
  }

  async function handleStart() {
    const record = recordQuery.data;
    if (!record) {
      toast.error('Save this record before running multiple calls.');
      return;
    }
    const parsedPayload = parsePayload(content);
    if (!parsedPayload) {
      toast.error('Payload is not valid JSON or has an invalid message/tool structure');
      return;
    }
    const activeTasks = tasks.filter((task) => !task.excluded);
    if (activeTasks.some(task => !task.model.trim())) return;
    if (activeTasks.length === 0) {
      toast.error('At least one non-excluded task is required');
      return;
    }
    if (!activeProvider?.apiKey) {
      toast.error('Configure a provider in Settings before submitting.');
      return;
    }

    if (isRunning || !await runGuard.approve({ taskCount: tasks.length, activeTaskCount: activeTasks.length, callCount,
      payloads: activeTasks.map((task) => ({ ...task, messages: parsedPayload.messages, tools: parsedPayload.tools })) })) return;

    setHistorySelection('live');
    setTestResultsByTaskId((prev) => {
      const next = { ...prev };
      for (const task of tasks) {
        if (!task.excluded) delete next[task.id];
      }
      return next;
    });

    const resultsSnapshot: Record<string, BatchCallResult[]> = { ...resultsByTaskId };
    for (const task of activeTasks) resultsSnapshot[task.id] = new Array(callCount);
    setResultsByTaskId({ ...resultsSnapshot });

    const progress: Record<string, TaskProgress> = {};
    for (const task of activeTasks) progress[task.id] = { done: 0, total: callCount };
    setProgressByTaskId(progress);
    setIsRunning(true);

    const provider = activeProvider;
    type Job = { taskId: string; callIndex: number };
    const jobs: Job[] = [];
    for (const task of activeTasks) {
      for (let i = 0; i < callCount; i++) jobs.push({ taskId: task.id, callIndex: i });
    }

    const runners = jobs.map(({ taskId }) => async (): Promise<BatchCallResult> => {
      const task = activeTasks.find((t) => t.id === taskId)!;
      const start = performance.now();
      try {
        const data = await submitCompletion({
          serverURL: provider.serverURL,
          apiKey: provider.apiKey,
          model: task.model,
          messages: parsedPayload.messages,
          tools: parsedPayload.tools,
          temperature: task.temperature,
          reasoningEffort: task.reasoningEffort,
          maxTokens: task.maxTokens,
        });
        return { success: true, data, durationMs: performance.now() - start };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err), durationMs: performance.now() - start };
      }
    });

    await runWithConcurrency(runners, pacing.value.concurrency, (index, callResult) => {
      const job = jobs[index];
      resultsSnapshot[job.taskId] = [...resultsSnapshot[job.taskId]];
      resultsSnapshot[job.taskId][job.callIndex] = callResult;
      setResultsByTaskId({ ...resultsSnapshot });
      setProgressByTaskId((prev) => ({
        ...prev,
        [job.taskId]: { done: (prev[job.taskId]?.done ?? 0) + 1, total: callCount },
      }));
    }, pacing.value.startIntervalMs);

    setIsRunning(false);
    runGuard.finish();
    persistRun(record, resultsSnapshot);
  }

  const selectedSnapshot = historySelection === 'live' ? null : history.find((snap) => snap.id === historySelection) ?? null;
  const displayedTasks = selectedSnapshot ? selectedSnapshot.tasks : tasks;
  const displayedCallCount = selectedSnapshot ? selectedSnapshot.callCount : callCount;
  const displayedResultsByTaskId = selectedSnapshot
    ? Object.fromEntries(selectedSnapshot.tasks.map((task, index) => [task.id, selectedSnapshot.results[index] ?? []]))
    : resultsByTaskId;

  const rawResponseText = useMemo(
    () =>
      JSON.stringify(
        {
          tasks: displayedTasks,
          callCount: displayedCallCount,
          results: displayedTasks.map((task) => displayedResultsByTaskId[task.id] ?? []),
          testSuite,
        },
        null,
        2,
      ),
    [displayedTasks, displayedCallCount, displayedResultsByTaskId, testSuite],
  );

  async function handleRunTests() {
    const jobs: TestJob[] = [];
    for (const task of displayedTasks) {
      const results = displayedResultsByTaskId[task.id] ?? [];
      results.forEach((callResult, callIndex) => {
        if (callResult?.success) {
          jobs.push({ taskId: task.id, callIndex, message: callResult.data.choices[0]?.message });
        }
      });
    }
    if (jobs.length === 0) {
      toast.error('No responses to test yet — run a batch first.');
      return;
    }

    if (!testRunnerRef.current) testRunnerRef.current = new TestRunner();
    setIsRunningTests(true);
    try {
      await testRunnerRef.current.runSuite(testSuite, jobs, (jobResult) => {
        setTestResultsByTaskId((prev) => ({
          ...prev,
          [jobResult.taskId]: { ...(prev[jobResult.taskId] ?? {}), [jobResult.callIndex]: jobResult.checks },
        }));
      });
    } finally {
      setIsRunningTests(false);
    }
  }

  if (recordId && recordQuery.isLoading) {
    return (
      <Flex align="center" justify="center" height="100vh">
        <Text color="gray">Loading...</Text>
      </Flex>
    );
  }

  if (recordId && !recordQuery.isLoading && recordQuery.data == null) {
    return (
      <Flex align="center" justify="center" height="100vh" direction="column" gap="3">
        <Text color="gray">Record not found.</Text>
        <Button onClick={() => navigate('/agent/records')}>Back to records</Button>
      </Flex>
    );
  }

  const providerReady = Boolean(activeProvider?.apiKey);
  const batchModelsReady = tasks.some((task) => !task.excluded) &&
    tasks.every((task) => task.excluded || task.model.trim().length > 0);

  return (
    <Box className={styles.page}>
      <SubmitLoadingOverlay active={completion.isPending} />
      <Toolbar
        name={name}
        onNew={handleNew}
        onSave={handleSave}
        onSaveAs={() => setSaveAsOpen(true)}
        isSaving={updateRecord.isPending || createRecord.isPending}
      />
      {runGuard.ui}

      <Flex className={styles.tabRow} align="end" gap="3" wrap="wrap">
        <SegmentedControl.Root className={styles.callModeSwitch} value={tab} onValueChange={(value) => handleTabChange(value as 'single' | 'multiple')} aria-label="Call mode">
          <SegmentedControl.Item value="single">Single call</SegmentedControl.Item>
          <SegmentedControl.Item value="multiple">Multiple calls</SegmentedControl.Item>
        </SegmentedControl.Root>

        {tab === 'single' ? (
          <>
            <Box width="280px" className={styles.field}>
              <span className={styles.label}>Model</span>
              <ModelAutoComplete
                value={model}
                onChange={setModel}
                suggestions={chatModelIds}
                priceByValue={chatModelPriceByValue}
              />
            </Box>
            <Box width="90px" className={styles.field}>
              <span className={styles.label}>Temperature</span>
              <TextField.Root
                type="number"
                step="0.1"
                min="0"
                max="2"
                placeholder="0–2"
                value={temperature}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setTemperature(Number.isFinite(parsed) ? parsed : 0);
                }}
              />
            </Box>
            <Box width="140px" className={styles.field}>
              <span className={styles.label}>Reasoning</span>
              <Select.Root
                disabled={reasoningUnsupported && !reasoningEffort}
                value={reasoningEffort ?? 'default'}
                onValueChange={(value) => setReasoningEffort(value === 'default' ? undefined : (value as ReasoningEffort))}
              >
                <Select.Trigger placeholder="Default" style={{ width: '100%' }} />
                <Select.Content>
                  {REASONING_EFFORT_OPTIONS.map((option) => (
                    <Select.Item key={option.value} value={option.value} disabled={reasoningUnsupported && option.value !== 'default'}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {reasoningUnsupported && <Text size="1" color="gray">Reasoning unavailable.{reasoningEffort ? ' Choose Default or another model.' : ''}</Text>}
            </Box>
            <Box width="120px" className={styles.field}>
              <span className={styles.label}>Max tokens</span>
              <TextField.Root
                type="number"
                step="1"
                min="1"
                max={runGuard.demo ? DEMO_MAX_OUTPUT_TOKENS : undefined}
                placeholder={runGuard.demo ? `Default: ${DEMO_MAX_OUTPUT_TOKENS}` : 'No limit'}
                value={maxTokens == null ? '' : Math.min(maxTokens, runGuard.demo ? DEMO_MAX_OUTPUT_TOKENS : Infinity)}
                onChange={(event) => {
                  const raw = event.target.value;
                  setMaxTokens(raw === '' ? undefined : Math.min(runGuard.demo ? DEMO_MAX_OUTPUT_TOKENS : Infinity, Math.max(1, Math.round(Number(raw)))));
                }}
              />
            </Box>
            <Flex flexGrow="1" />
            <Button onClick={handleSubmit} disabled={!providerReady || !model.trim() || completion.isPending} loading={completion.isPending}>
              <Play size={16} /> Submit
            </Button>
          </>
        ) : (
          <MultipleToolbar
              pacing={pacing}
            maxCallCount={runGuard.maxCalls}
            addTaskDisabled={tasks.length >= runGuard.maxTasks}
            callCount={callCount}
            onCallCountChange={handleCallCountChange}
            onAddTask={handleAddTask}
            onStart={handleStart}
            isRunning={isRunning}
            startDisabled={!recordId || !providerReady || !batchModelsReady}
            history={history}
            historySelection={historySelection}
            onHistorySelectionChange={setHistorySelection}
          />
        )}
      </Flex>

      {!providerReady && (
        <Box px="4" pt="3">
          <ProviderWarning />
        </Box>
      )}

      {tab === 'multiple' && !recordId && (
        <Box px="4" pt="2">
          <Callout.Root color="gray">
            <Callout.Text>Save this record before running multiple calls.</Callout.Text>
          </Callout.Root>
        </Box>
      )}

      {tab === 'multiple' && (
        <Box px="4" pt="2">
          <Text size="1" color="gray">
            You can edit the prompt in{' '}
            <button type="button" className={styles.inlineModeLink} onClick={() => handleTabChange('single')}>
              Single call
            </button>{' '}mode.
          </Text>
        </Box>
      )}

      {tab === 'single' ? (
        <>
          <Flex className={styles.modeRow}>
            <SegmentedControl.Root value={mode} onValueChange={(value) => setMode(value as 'editor' | 'form')}>
              <SegmentedControl.Item value="editor">Editor</SegmentedControl.Item>
              <SegmentedControl.Item value="form">Form</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>

          <Box className={styles.split}>
            <Box className={styles.pane}>
              {mode === 'editor' ? (
                <Flex direction="column" gap="2" height="100%">
                  <Flex gap="2">
                    <Button variant="ghost" color="gray" size="1" onClick={handleCopyJson}>
                      Copy JSON
                    </Button>
                    <Button variant="ghost" size="1" color="red" onClick={handleClear}>
                      Clear
                    </Button>
                  </Flex>
                  <Box flexGrow="1" style={{ minHeight: 0, fontSize: 13 }}>
                    <JsonEditor value={content} onChange={setContent} height="100%" />
                  </Box>
                </Flex>
              ) : (
                <FormEditor content={content} onChange={setContent} />
              )}
            </Box>
            <Box className={styles.pane}>
              <ResultPanel result={result} error={requestError} durationMs={durationMs} onAppendToMessages={handleAppendToMessages} />
            </Box>
          </Box>
        </>
      ) : (
        <>
          <Box className={styles.content} style={{ paddingBottom: height + 16 }}>
            <MultipleTasksTable
            maxTokensLimit={runGuard.demo && !selectedSnapshot ? DEMO_MAX_OUTPUT_TOKENS : undefined}
              tasks={displayedTasks}
              resultsByTaskId={displayedResultsByTaskId}
              testResultsByTaskId={testResultsByTaskId}
              progressByTaskId={progressByTaskId}
              isRunning={isRunning}
              callCount={displayedCallCount}
              onTaskChange={handleTaskChange}
              onRemoveTask={handleRemoveTask}
              readOnly={selectedSnapshot != null}
            />
          </Box>

          <BottomPanel
            height={height}
            onStartResize={startDrag}
            testSuite={testSuite}
            onTestSuiteChange={setTestSuite}
            rawResponseText={rawResponseText}
            onRunTests={handleRunTests}
            isRunningTests={isRunningTests}
          />
        </>
      )}

      <SaveAsDialog open={saveAsOpen} onOpenChange={setSaveAsOpen} onSave={handleSaveAsConfirm} initialName={name} />

      <ConfirmDialog
        open={pendingSubmitPayload != null}
        onOpenChange={(open) => !open && setPendingSubmitPayload(null)}
        title="Last message is not from the user"
        description={<>The last message's role is "{pendingSubmitPayload?.messages[pendingSubmitPayload.messages.length - 1]?.role}",
          not "user". Submit anyway?</>}
        confirmLabel="Submit anyway"
        onConfirm={() => {
          if (pendingSubmitPayload) performSubmit(pendingSubmitPayload.messages, pendingSubmitPayload.tools);
          setPendingSubmitPayload(null);
        }}
      />

      <ConfirmDialog {...discardDialogProps} />
    </Box>
  );
}
