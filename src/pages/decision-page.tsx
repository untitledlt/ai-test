import { useBatchPacing } from '../hooks/use-batch-pacing';
import { useRunGuard } from '../hooks/use-run-guard';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Callout, Flex, Heading, SegmentedControl } from '@radix-ui/themes';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { JsonEditor } from '@untitled/ui-kit';
import { ConfirmDialog } from '../components/confirm-dialog';
import { ProviderWarning } from '../components/provider-warning';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { BatchRunControls } from '../components/batch-run-controls';
import { Toolbar } from '../components/toolbar';
import { SaveAsDialog } from '../components/save-as-dialog';
import { StateList } from '../components/state-list';
import { QuestionCard } from '../components/question-card';
import { DecisionTasksTable } from '../components/decision-tasks-table';
import type { TaskProgress } from '../components/multiple-tasks-table';
import { useActiveProvider } from '../hooks/use-providers';
import { useCreateDecisionRecord, useDecisionRecord, useUpdateDecisionRecord } from '../hooks/use-decision-records';
import { submitDecision } from '../lib/openrouter-client';
import { runWithConcurrency } from '../lib/batch-runner';
import {
  buildDecisionRequestObject,
  createDecisionTask,
  createQuestionDraft,
  parseDecisionRequestObject,
  DEFAULT_DECISION_MODEL,
} from '../lib/decision-utils';
import type { DecisionTask, QuestionDraft, StateItem } from '../lib/decision-utils';
import { randomUUID } from '../lib/uuid';
import type { DecisionCallResult } from '../types';
import type { DecisionRecord } from '../db/types';
import styles from './decision-page.module.css';

const DRAFT_STORAGE_KEY = 'ai-test-agent:decision-draft';

function buildDecisionPageContentString(
  stateItems: StateItem[],
  questions: QuestionDraft[],
  tasks: DecisionTask[],
  callCount: number,
): string {
  const { state, questions: questionsRecord } = buildDecisionRequestObject(stateItems, questions);
  const tasksForStorage = tasks.map(({ model, excluded }) => ({ model, excluded: excluded ?? false }));
  return JSON.stringify({ state, questions: questionsRecord, tasks: tasksForStorage, callCount });
}

function parseDecisionPageContent(raw: string): {
  stateItems: StateItem[];
  questions: QuestionDraft[];
  tasks: DecisionTask[];
  callCount: number;
} {
  const requestPart = parseDecisionRequestObject(raw);
  let tasks: DecisionTask[] = [createDecisionTask()];
  let callCount = 1;
  try {
    const parsed = JSON.parse(raw) as { tasks?: unknown; callCount?: unknown };
    if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      tasks = parsed.tasks.map((entry) => {
        const candidate = entry as { model?: unknown; excluded?: unknown };
        return {
          id: randomUUID(),
          model: typeof candidate.model === 'string' ? candidate.model : DEFAULT_DECISION_MODEL,
          excluded: Boolean(candidate.excluded),
        };
      });
    }
    if (typeof parsed.callCount === 'number' && parsed.callCount >= 1) {
      callCount = Math.round(parsed.callCount);
    }
  } catch {
    // keep defaults
  }
  return { stateItems: requestPart?.stateItems ?? [], questions: requestPart?.questions ?? [], tasks, callCount };
}

type SavedSnapshot = { name: string; content: string };

function blankSavedSnapshot(): SavedSnapshot {
  return { name: '', content: buildDecisionPageContentString([], [], [createDecisionTask()], 1) };
}

type DraftSnapshot = {
  name: string;
  stateItems: StateItem[];
  questions: QuestionDraft[];
  tasks: DecisionTask[];
  callCount: number;
};

function loadDraft(): DraftSnapshot | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftSnapshot;
  } catch {
    return null;
  }
}

function saveDraft(draft: DraftSnapshot) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // best-effort; a full/unavailable localStorage shouldn't break editing
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function DecisionPage() {
  const { decisionId } = useParams<{ decisionId: string }>();
  const navigate = useNavigate();
  const recordQuery = useDecisionRecord(decisionId);
  const createRecord = useCreateDecisionRecord();
  const updateRecord = useUpdateDecisionRecord();
  const { activeProvider } = useActiveProvider();
  const runGuard = useRunGuard(activeProvider);
  const pacing = useBatchPacing(runGuard.demo);

  const [name, setName] = useState(() => (decisionId ? '' : (loadDraft()?.name ?? '')));
  const [stateItems, setStateItems] = useState<StateItem[]>(() => (decisionId ? [] : (loadDraft()?.stateItems ?? [])));
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => (decisionId ? [] : (loadDraft()?.questions ?? [])));
  const [tasks, setTasks] = useState<DecisionTask[]>(() =>
    decisionId ? [createDecisionTask()] : (loadDraft()?.tasks ?? [createDecisionTask()]),
  );
  const [callCount, setCallCount] = useState(() => (decisionId ? 1 : (loadDraft()?.callCount ?? 1)));
  const [resultsByTaskId, setResultsByTaskId] = useState<Record<string, DecisionCallResult[]>>({});
  const [progressByTaskId, setProgressByTaskId] = useState<Record<string, TaskProgress | undefined>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const [isJsonInvalid, setIsJsonInvalid] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  // A restored browser draft is the starting point, not a new edit.
  const lastSaved = useRef<SavedSnapshot>({
    name,
    content: buildDecisionPageContentString(stateItems, questions, tasks, callCount),
  });
  const isDirtyRef = useRef(false);
  const loadedForDecisionId = useRef<string | undefined>(undefined);

  function resetToBlank() {
    setName('');
    setStateItems([]);
    setQuestions([]);
    setTasks([createDecisionTask()]);
    setCallCount(1);
    setResultsByTaskId({});
    setProgressByTaskId({});
    setMode('form');
    setJsonDraft(null);
    setIsJsonInvalid(false);
    lastSaved.current = blankSavedSnapshot();
    isDirtyRef.current = false;
    clearDraft();
  }

  useEffect(() => {
    if (decisionId && recordQuery.data && loadedForDecisionId.current !== decisionId) {
      loadedForDecisionId.current = decisionId;
      const record = recordQuery.data;
      const parsed = parseDecisionPageContent(record.content);
      setName(record.name);
      setStateItems(parsed.stateItems);
      setQuestions(parsed.questions);
      setTasks(parsed.tasks);
      setCallCount(parsed.callCount);
      setResultsByTaskId({});
      setProgressByTaskId({});
      setMode('form');
      setIsJsonInvalid(false);
      lastSaved.current = {
        name: record.name,
        content: buildDecisionPageContentString(parsed.stateItems, parsed.questions, parsed.tasks, parsed.callCount),
      };
      isDirtyRef.current = false;
    }
    if (!decisionId && loadedForDecisionId.current !== undefined) {
      loadedForDecisionId.current = undefined;
      resetToBlank();
    }
  }, [decisionId, recordQuery.data]);

  useEffect(() => {
    const currentContent = buildDecisionPageContentString(stateItems, questions, tasks, callCount);
    isDirtyRef.current = name !== lastSaved.current.name || currentContent !== lastSaved.current.content;
  });

  // Auto-saves an in-progress, never-yet-saved document so a reload doesn't lose it. A
  // record that already has a decisionId is persisted to PouchDB on Save instead, so it's
  // excluded here to avoid a stale draft reappearing after that record is later deleted.
  useEffect(() => {
    if (decisionId) return;
    saveDraft({ name, stateItems, questions, tasks, callCount });
  }, [decisionId, name, stateItems, questions, tasks, callCount]);

  const { guardedAction, discardDialogProps } = useUnsavedChanges(isDirtyRef);

  function handleNew() {
    guardedAction(() => {
      if (decisionId) navigate('/decision');
      else resetToBlank();
    });
  }

  function handleModeChange(nextMode: 'form' | 'json') {
    if (nextMode === 'json') {
      setJsonDraft(JSON.stringify(buildDecisionRequestObject(stateItems, questions), null, 2));
      setIsJsonInvalid(false);
      setMode('json');
      return;
    }
    if (isJsonInvalid) return;
    setMode('form');
  }

  function handleJsonChange(value: string) {
    setJsonDraft(value);
    const parsed = parseDecisionRequestObject(value);
    if (parsed) {
      setStateItems(parsed.stateItems);
      setQuestions(parsed.questions);
      setIsJsonInvalid(false);
    } else {
      setIsJsonInvalid(true);
    }
  }

  function handleSave() {
    const content = buildDecisionPageContentString(stateItems, questions, tasks, callCount);
    if (decisionId && recordQuery.data) {
      updateRecord.mutate(
        { ...(recordQuery.data as DecisionRecord), name, content },
        {
          onSuccess: () => {
            lastSaved.current = { name, content };
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
    const content = buildDecisionPageContentString(stateItems, questions, tasks, callCount);
    createRecord.mutate(
      { name: newName, content },
      {
        onSuccess: (doc) => {
          setName(newName);
          lastSaved.current = { name: newName, content };
          isDirtyRef.current = false;
          clearDraft();
          navigate(`/decision/${doc._id}`, { replace: true });
          toast.success('Saved');
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (startDisabled) return;
        handleStart();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (updateRecord.isPending || createRecord.isPending) return;
        handleSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function handleTaskChange(taskId: string, patch: Partial<DecisionTask>) {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }

  function handleAddTask() {
    if (tasks.length >= runGuard.maxTasks) return;
    setTasks([...tasks, createDecisionTask()]);
  }

  function handleRemoveTask(taskId: string) {
    setTasks(tasks.filter((task) => task.id !== taskId));
    setResultsByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setProgressByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  const providerReady = Boolean(activeProvider?.apiKey);
  const { questions: questionsRecord } = buildDecisionRequestObject(stateItems, questions);
  const hasSubmittableQuestions = Object.keys(questionsRecord).length > 0;
  const activeTasks = tasks.filter((task) => !task.excluded);
  const modelsReady = activeTasks.length > 0 && activeTasks.every((task) => task.model.trim().length > 0);
  const startDisabled = !providerReady || !hasSubmittableQuestions || !modelsReady || isRunning || isJsonInvalid;

  async function handleStart() {
    if (!activeProvider?.apiKey || !modelsReady || !hasSubmittableQuestions) return;
    const provider = activeProvider;
    const { state, questions: questionsForRequest } = buildDecisionRequestObject(stateItems, questions);

    if (isRunning || !await runGuard.approve({ taskCount: tasks.length, activeTaskCount: activeTasks.length, callCount,
      payloads: activeTasks.map((task) => ({ ...task, state, questions: questionsForRequest })) })) return;

    const resultsSnapshot: Record<string, DecisionCallResult[]> = { ...resultsByTaskId };
    for (const task of activeTasks) resultsSnapshot[task.id] = new Array(callCount);
    setResultsByTaskId({ ...resultsSnapshot });

    const progress: Record<string, TaskProgress> = {};
    for (const task of activeTasks) progress[task.id] = { done: 0, total: callCount };
    setProgressByTaskId(progress);
    setIsRunning(true);

    type Job = { taskId: string; callIndex: number };
    const jobs: Job[] = [];
    for (const task of activeTasks) {
      for (let i = 0; i < callCount; i++) jobs.push({ taskId: task.id, callIndex: i });
    }

    const runners = jobs.map(({ taskId }) => async (): Promise<DecisionCallResult> => {
      const task = activeTasks.find((t) => t.id === taskId)!;
      const start = performance.now();
      try {
        const data = await submitDecision({
          serverURL: provider.serverURL,
          apiKey: provider.apiKey,
          model: task.model,
          state,
          questions: questionsForRequest,
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
  }

  return (
    <Flex direction="column" height="100%">
      <Toolbar
        name={name}
        onNew={handleNew}
        onSave={handleSave}
        onSaveAs={() => setSaveAsOpen(true)}
        isSaving={updateRecord.isPending || createRecord.isPending}
        loadPath="/decision/records"
      />
      {runGuard.ui}

      <Flex direction="column" gap="4" p="4">
        {!providerReady && (
          <ProviderWarning />
        )}

        <Box className={styles.layout}>
          <Box className={styles.formColumn}>
            <SegmentedControl.Root value={mode} onValueChange={(value) => handleModeChange(value as 'form' | 'json')}>
              <SegmentedControl.Item value="form">Form</SegmentedControl.Item>
              <SegmentedControl.Item value="json">JSON</SegmentedControl.Item>
            </SegmentedControl.Root>

            {isJsonInvalid && (
              <Callout.Root color="red">
                <Callout.Text>Payload is not valid JSON</Callout.Text>
              </Callout.Root>
            )}

            {mode === 'form' ? (
              <>
                <Box>
                  <Heading size="3" mb="2">
                    State
                  </Heading>
                  <StateList items={stateItems} onChange={setStateItems} />
                </Box>

                <Box>
                  <Flex justify="between" align="center" mb="2">
                    <Heading size="3">Questions</Heading>
                    <Button variant="soft" size="1" onClick={() => setQuestions([...questions, createQuestionDraft()])}>
                      Add question
                    </Button>
                  </Flex>
                  <Flex direction="column" gap="2">
                    {questions.map((draft, index) => (
                      <QuestionCard
                        key={draft.id}
                        draft={draft}
                        onChange={(next) => setQuestions(questions.map((q, i) => (i === index ? next : q)))}
                        onRemove={() => setQuestions(questions.filter((_, i) => i !== index))}
                      />
                    ))}
                  </Flex>
                </Box>
              </>
            ) : (
              <Box>
                <Flex mb="2">
                  <Button
                    variant="ghost"
                    color="gray"
                    size="1"
                    onClick={() => navigator.clipboard.writeText(jsonDraft ?? '')}
                  >
                    Copy JSON
                  </Button>
                </Flex>
                <JsonEditor value={jsonDraft ?? ''} onChange={handleJsonChange} height="300px" />
              </Box>
            )}

            <BatchRunControls
              pacing={pacing}
            maxCallCount={runGuard.maxCalls}
              callCount={callCount}
              onCallCountChange={setCallCount}
              onStart={handleStart}
              isRunning={isRunning}
              startDisabled={startDisabled}
            />
          </Box>

          <Box className={styles.resultsColumn}>
            <Flex justify="end" mb="2">
              <Button variant="outline" color="gray" onClick={handleAddTask} disabled={isRunning || tasks.length >= runGuard.maxTasks}>
                <Plus size={14} /> Add model
              </Button>
            </Flex>
            <DecisionTasksTable
              tasks={tasks}
              resultsByTaskId={resultsByTaskId}
              progressByTaskId={progressByTaskId}
              isRunning={isRunning}
              callCount={callCount}
              onTaskChange={handleTaskChange}
              onRemoveTask={handleRemoveTask}
            />
          </Box>
        </Box>
      </Flex>

      <SaveAsDialog open={saveAsOpen} onOpenChange={setSaveAsOpen} onSave={handleSaveAsConfirm} initialName={name} />

      <ConfirmDialog {...discardDialogProps} />
    </Flex>
  );
}
