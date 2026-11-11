import { useBatchPacing } from '../hooks/use-batch-pacing';
import { useRunGuard } from '../hooks/use-run-guard';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Callout, Flex, Heading, TextArea } from '@radix-ui/themes';
import { JsonEditor } from '@untitled/ui-kit';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/confirm-dialog';
import { ProviderWarning } from '../components/provider-warning';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { BatchRunControls } from '../components/batch-run-controls';
import { Toolbar } from '../components/toolbar';
import { SaveAsDialog } from '../components/save-as-dialog';
import { ImagePicker } from '../components/image-picker';
import { ExtractTasksTable } from '../components/extract-tasks-table';
import type { TaskProgress } from '../components/multiple-tasks-table';
import { useActiveProvider } from '../hooks/use-providers';
import { useCreateExtractRecord, useExtractRecord, useUpdateExtractRecord } from '../hooks/use-extract-records';
import { submitExtraction } from '../lib/openrouter-client';
import { runWithConcurrency } from '../lib/batch-runner';
import { createExtractTask, DEFAULT_EXTRACTION_SCHEMA } from '../lib/extract-utils';
import type { ExtractTask } from '../lib/extract-utils';
import type { InputImage } from '../lib/image-gen-utils';
import { randomUUID } from '../lib/uuid';
import type { ExtractionCallResult } from '../types';
import type { ExtractRecord } from '../db/types';
import styles from './decision-page.module.css';

const DRAFT_STORAGE_KEY = 'ai-test-agent:extract-draft';
const DEFAULT_INSTRUCTIONS =
  'Extract the requested fields from the attached image(s) according to the provided JSON schema.';

function buildExtractContentString(
  instructions: string,
  schema: string,
  inputImages: InputImage[],
  tasks: ExtractTask[],
  callCount: number,
): string {
  const inputImagesForStorage = inputImages.map(({ dataUrl, fileName }) => ({ dataUrl, fileName }));
  const tasksForStorage = tasks.map(({ model, excluded }) => ({ model, excluded: excluded ?? false }));
  return JSON.stringify({ instructions, schema, inputImages: inputImagesForStorage, tasks: tasksForStorage, callCount });
}

function parseExtractContent(raw: string): {
  instructions: string;
  schema: string;
  inputImages: InputImage[];
  tasks: ExtractTask[];
  callCount: number;
} {
  let instructions = '';
  let schema = DEFAULT_EXTRACTION_SCHEMA;
  let inputImages: InputImage[] = [];
  let tasks: ExtractTask[] = [createExtractTask()];
  let callCount = 1;
  try {
    const parsed = JSON.parse(raw) as {
      instructions?: unknown;
      schema?: unknown;
      inputImages?: unknown;
      tasks?: unknown;
      callCount?: unknown;
    };
    if (typeof parsed.instructions === 'string') instructions = parsed.instructions;
    if (typeof parsed.schema === 'string') schema = parsed.schema;
    if (Array.isArray(parsed.inputImages)) {
      inputImages = parsed.inputImages
        .map((entry) => {
          const candidate = entry as { dataUrl?: unknown; fileName?: unknown };
          return {
            id: randomUUID(),
            dataUrl: typeof candidate.dataUrl === 'string' ? candidate.dataUrl : '',
            fileName: typeof candidate.fileName === 'string' ? candidate.fileName : undefined,
          };
        })
        .filter((image) => image.dataUrl !== '');
    }
    if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      tasks = parsed.tasks.map((entry) => {
        const candidate = entry as { model?: unknown; excluded?: unknown };
        return {
          id: randomUUID(),
          model: typeof candidate.model === 'string' ? candidate.model : '',
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
  return { instructions, schema, inputImages, tasks, callCount };
}

type SavedSnapshot = { name: string; content: string };

function blankSavedSnapshot(): SavedSnapshot {
  return {
    name: '',
    content: buildExtractContentString('', DEFAULT_EXTRACTION_SCHEMA, [], [createExtractTask()], 1),
  };
}

type DraftSnapshot = {
  name: string;
  instructions: string;
  schema: string;
  inputImages: InputImage[];
  tasks: ExtractTask[];
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

function parseSchema(schema: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(schema);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function ExtractPage() {
  const { extractId } = useParams<{ extractId: string }>();
  const navigate = useNavigate();
  const recordQuery = useExtractRecord(extractId);
  const createRecord = useCreateExtractRecord();
  const updateRecord = useUpdateExtractRecord();
  const { activeProvider } = useActiveProvider();
  const runGuard = useRunGuard(activeProvider);
  const pacing = useBatchPacing(runGuard.demo);

  const [name, setName] = useState(() => (extractId ? '' : (loadDraft()?.name ?? '')));
  const [instructions, setInstructions] = useState(() => (extractId ? '' : (loadDraft()?.instructions ?? '')));
  const [schema, setSchema] = useState(() =>
    extractId ? DEFAULT_EXTRACTION_SCHEMA : (loadDraft()?.schema ?? DEFAULT_EXTRACTION_SCHEMA),
  );
  const [inputImages, setInputImages] = useState<InputImage[]>(() =>
    extractId ? [] : (loadDraft()?.inputImages ?? []),
  );
  const [tasks, setTasks] = useState<ExtractTask[]>(() =>
    extractId ? [createExtractTask()] : (loadDraft()?.tasks ?? [createExtractTask()]),
  );
  const [callCount, setCallCount] = useState(() => (extractId ? 1 : (loadDraft()?.callCount ?? 1)));
  const [resultsByTaskId, setResultsByTaskId] = useState<Record<string, ExtractionCallResult[]>>({});
  const [progressByTaskId, setProgressByTaskId] = useState<Record<string, TaskProgress | undefined>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  // A restored browser draft is the starting point, not a new edit.
  const lastSaved = useRef<SavedSnapshot>({
    name,
    content: buildExtractContentString(instructions, schema, inputImages, tasks, callCount),
  });
  const isDirtyRef = useRef(false);
  const loadedForExtractId = useRef<string | undefined>(undefined);

  function resetToBlank() {
    setName('');
    setInstructions('');
    setSchema(DEFAULT_EXTRACTION_SCHEMA);
    setInputImages([]);
    setTasks([createExtractTask()]);
    setCallCount(1);
    setResultsByTaskId({});
    setProgressByTaskId({});
    lastSaved.current = blankSavedSnapshot();
    isDirtyRef.current = false;
    clearDraft();
  }

  useEffect(() => {
    if (extractId && recordQuery.data && loadedForExtractId.current !== extractId) {
      loadedForExtractId.current = extractId;
      const record = recordQuery.data;
      const parsed = parseExtractContent(record.content);
      setName(record.name);
      setInstructions(parsed.instructions);
      setSchema(parsed.schema);
      setInputImages(parsed.inputImages);
      setTasks(parsed.tasks);
      setCallCount(parsed.callCount);
      setResultsByTaskId({});
      setProgressByTaskId({});
      lastSaved.current = {
        name: record.name,
        content: buildExtractContentString(parsed.instructions, parsed.schema, parsed.inputImages, parsed.tasks, parsed.callCount),
      };
      isDirtyRef.current = false;
    }
    if (!extractId && loadedForExtractId.current !== undefined) {
      loadedForExtractId.current = undefined;
      resetToBlank();
    }
  }, [extractId, recordQuery.data]);

  useEffect(() => {
    const currentContent = buildExtractContentString(instructions, schema, inputImages, tasks, callCount);
    isDirtyRef.current = name !== lastSaved.current.name || currentContent !== lastSaved.current.content;
  });

  // Auto-saves an in-progress, never-yet-saved document so a reload doesn't lose it. A
  // record that already has an extractId is persisted to PouchDB on Save instead, so it's
  // excluded here to avoid a stale draft reappearing after that record is later deleted.
  useEffect(() => {
    if (extractId) return;
    saveDraft({ name, instructions, schema, inputImages, tasks, callCount });
  }, [extractId, name, instructions, schema, inputImages, tasks, callCount]);

  const { guardedAction, discardDialogProps } = useUnsavedChanges(isDirtyRef);

  function handleNew() {
    guardedAction(() => {
      if (extractId) navigate('/extract');
      else resetToBlank();
    });
  }

  function handleSave() {
    const content = buildExtractContentString(instructions, schema, inputImages, tasks, callCount);
    if (extractId && recordQuery.data) {
      updateRecord.mutate(
        { ...(recordQuery.data as ExtractRecord), name, content },
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
    const content = buildExtractContentString(instructions, schema, inputImages, tasks, callCount);
    createRecord.mutate(
      { name: newName, content },
      {
        onSuccess: (doc) => {
          setName(newName);
          lastSaved.current = { name: newName, content };
          isDirtyRef.current = false;
          clearDraft();
          navigate(`/extract/${doc._id}`, { replace: true });
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

  function handleTaskChange(taskId: string, patch: Partial<ExtractTask>) {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }

  function handleAddTask() {
    if (tasks.length >= runGuard.maxTasks) return;
    setTasks([...tasks, createExtractTask()]);
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
  const hasImages = inputImages.length > 0;
  const parsedSchema = parseSchema(schema);
  const schemaValid = parsedSchema != null;
  const activeTasks = tasks.filter((task) => !task.excluded);
  const modelsReady = activeTasks.length > 0 && activeTasks.every((task) => task.model.trim().length > 0);
  const startDisabled =
    !providerReady || !hasImages || !schemaValid || !modelsReady || isRunning;

  async function handleStart() {
    if (!activeProvider?.apiKey || !modelsReady || !hasImages || !parsedSchema) return;
    const provider = activeProvider;
    const inputImageDataUrls = inputImages.map((image) => image.dataUrl);
    const instructionsText = instructions.trim() || DEFAULT_INSTRUCTIONS;

    if (isRunning || !await runGuard.approve({ taskCount: tasks.length, activeTaskCount: activeTasks.length, callCount,
      payloads: activeTasks.map((task) => ({ ...task, instructions: instructionsText, schema: parsedSchema, inputImageDataUrls })) })) return;

    const resultsSnapshot: Record<string, ExtractionCallResult[]> = { ...resultsByTaskId };
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

    const runners = jobs.map(({ taskId }) => async (): Promise<ExtractionCallResult> => {
      const task = activeTasks.find((t) => t.id === taskId)!;
      const start = performance.now();
      try {
        const data = await submitExtraction({
          serverURL: provider.serverURL,
          apiKey: provider.apiKey,
          model: task.model,
          instructions: instructionsText,
          schema: parsedSchema,
          inputImageDataUrls,
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
        loadPath="/extract/records"
      />
      {runGuard.ui}

      <Flex direction="column" gap="4" p="4">
        {!providerReady && (
          <ProviderWarning />
        )}

        <Box className={styles.layout}>
          <Box className={styles.formColumn}>
            <Box>
              <Heading size="3" mb="2">
                Images
              </Heading>
              <ImagePicker images={inputImages} onChange={setInputImages} />
            </Box>

            <Box>
              <Heading size="3" mb="2">
                Instructions
              </Heading>
              <TextArea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder={DEFAULT_INSTRUCTIONS}
                rows={3}
              />
            </Box>

            <Box>
              <Heading size="3" mb="2">
                JSON schema
              </Heading>
              {!schemaValid && (
                <Callout.Root color="red" mb="2">
                  <Callout.Text>Schema is not valid JSON</Callout.Text>
                </Callout.Root>
              )}
              <Box style={{ height: 240, fontSize: 13, overflow: 'auto' }}>
                <JsonEditor value={schema} onChange={setSchema} height="100%" />
              </Box>
            </Box>

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
            <ExtractTasksTable
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
