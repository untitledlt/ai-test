import { useBatchPacing } from '../hooks/use-batch-pacing';
import { useRunGuard } from '../hooks/use-run-guard';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Flex, Heading, TextArea } from '@radix-ui/themes';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/confirm-dialog';
import { ProviderWarning } from '../components/provider-warning';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { BatchRunControls } from '../components/batch-run-controls';
import { Toolbar } from '../components/toolbar';
import { SaveAsDialog } from '../components/save-as-dialog';
import { ImagePicker } from '../components/image-picker';
import { ImageGenTasksTable } from '../components/image-gen-tasks-table';
import type { TaskProgress } from '../components/multiple-tasks-table';
import { useActiveProvider } from '../hooks/use-providers';
import { useImageModelOptions } from '../hooks/use-image-models';
import { useCreateImageGenRecord, useImageGenRecord, useUpdateImageGenRecord } from '../hooks/use-image-gen-records';
import { submitImageGeneration } from '../lib/openrouter-client';
import { runWithConcurrency } from '../lib/batch-runner';
import { createImageGenTask } from '../lib/image-gen-utils';
import type { ImageGenTask, InputImage } from '../lib/image-gen-utils';
import { randomUUID } from '../lib/uuid';
import type { ImageGenCallResult } from '../types';
import type { ImageGenRecord } from '../db/types';
import styles from './decision-page.module.css';

const DRAFT_STORAGE_KEY = 'ai-test-agent:image-gen-draft';

function buildImageGenContentString(
  prompt: string,
  inputImages: InputImage[],
  tasks: ImageGenTask[],
  callCount: number,
): string {
  const inputImagesForStorage = inputImages.map(({ dataUrl, fileName }) => ({ dataUrl, fileName }));
  const tasksForStorage = tasks.map(({ model, excluded, aspectRatio, resolution }) => ({
    model,
    excluded: excluded ?? false,
    aspectRatio,
    resolution,
  }));
  return JSON.stringify({ prompt, inputImages: inputImagesForStorage, tasks: tasksForStorage, callCount });
}

function parseImageGenContent(raw: string): {
  prompt: string;
  inputImages: InputImage[];
  tasks: ImageGenTask[];
  callCount: number;
} {
  let prompt = '';
  let inputImages: InputImage[] = [];
  let tasks: ImageGenTask[] = [createImageGenTask()];
  let callCount = 1;
  try {
    const parsed = JSON.parse(raw) as {
      prompt?: unknown;
      inputImages?: unknown;
      tasks?: unknown;
      callCount?: unknown;
    };
    if (typeof parsed.prompt === 'string') prompt = parsed.prompt;
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
        const candidate = entry as {
          model?: unknown;
          excluded?: unknown;
          aspectRatio?: unknown;
          resolution?: unknown;
        };
        return {
          id: randomUUID(),
          model: typeof candidate.model === 'string' ? candidate.model : '',
          excluded: Boolean(candidate.excluded),
          aspectRatio: typeof candidate.aspectRatio === 'string' ? candidate.aspectRatio : undefined,
          resolution: typeof candidate.resolution === 'string' ? candidate.resolution : undefined,
        };
      });
    }
    if (typeof parsed.callCount === 'number' && parsed.callCount >= 1) {
      callCount = Math.round(parsed.callCount);
    }
  } catch {
    // keep defaults
  }
  return { prompt, inputImages, tasks, callCount };
}

type SavedSnapshot = { name: string; content: string };

function blankSavedSnapshot(): SavedSnapshot {
  return { name: '', content: buildImageGenContentString('', [], [createImageGenTask()], 1) };
}

type DraftSnapshot = {
  name: string;
  prompt: string;
  inputImages: InputImage[];
  tasks: ImageGenTask[];
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

export function ImagePage() {
  const { imageId } = useParams<{ imageId: string }>();
  const navigate = useNavigate();
  const recordQuery = useImageGenRecord(imageId);
  const createRecord = useCreateImageGenRecord();
  const updateRecord = useUpdateImageGenRecord();
  const { activeProvider } = useActiveProvider();
  const runGuard = useRunGuard(activeProvider);
  const pacing = useBatchPacing(runGuard.demo);
  const { optionsById } = useImageModelOptions();

  const [name, setName] = useState(() => (imageId ? '' : (loadDraft()?.name ?? '')));
  const [prompt, setPrompt] = useState(() => (imageId ? '' : (loadDraft()?.prompt ?? '')));
  const [inputImages, setInputImages] = useState<InputImage[]>(() => (imageId ? [] : (loadDraft()?.inputImages ?? [])));
  const [tasks, setTasks] = useState<ImageGenTask[]>(() =>
    imageId ? [createImageGenTask()] : (loadDraft()?.tasks ?? [createImageGenTask()]),
  );
  const [callCount, setCallCount] = useState(() => (imageId ? 1 : (loadDraft()?.callCount ?? 1)));
  const [resultsByTaskId, setResultsByTaskId] = useState<Record<string, ImageGenCallResult[]>>({});
  const [progressByTaskId, setProgressByTaskId] = useState<Record<string, TaskProgress | undefined>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  // A restored browser draft is the starting point, not a new edit.
  const lastSaved = useRef<SavedSnapshot>({
    name,
    content: buildImageGenContentString(prompt, inputImages, tasks, callCount),
  });
  const isDirtyRef = useRef(false);
  const loadedForImageId = useRef<string | undefined>(undefined);

  function resetToBlank() {
    setName('');
    setPrompt('');
    setInputImages([]);
    setTasks([createImageGenTask()]);
    setCallCount(1);
    setResultsByTaskId({});
    setProgressByTaskId({});
    lastSaved.current = blankSavedSnapshot();
    isDirtyRef.current = false;
    clearDraft();
  }

  useEffect(() => {
    if (imageId && recordQuery.data && loadedForImageId.current !== imageId) {
      loadedForImageId.current = imageId;
      const record = recordQuery.data;
      const parsed = parseImageGenContent(record.content);
      setName(record.name);
      setPrompt(parsed.prompt);
      setInputImages(parsed.inputImages);
      setTasks(parsed.tasks);
      setCallCount(parsed.callCount);
      setResultsByTaskId({});
      setProgressByTaskId({});
      lastSaved.current = {
        name: record.name,
        content: buildImageGenContentString(parsed.prompt, parsed.inputImages, parsed.tasks, parsed.callCount),
      };
      isDirtyRef.current = false;
    }
    if (!imageId && loadedForImageId.current !== undefined) {
      loadedForImageId.current = undefined;
      resetToBlank();
    }
  }, [imageId, recordQuery.data]);

  useEffect(() => {
    const currentContent = buildImageGenContentString(prompt, inputImages, tasks, callCount);
    isDirtyRef.current = name !== lastSaved.current.name || currentContent !== lastSaved.current.content;
  });

  // Auto-saves an in-progress, never-yet-saved document so a reload doesn't lose it. A
  // record that already has an imageId is persisted to PouchDB on Save instead, so it's
  // excluded here to avoid a stale draft reappearing after that record is later deleted.
  useEffect(() => {
    if (imageId) return;
    saveDraft({ name, prompt, inputImages, tasks, callCount });
  }, [imageId, name, prompt, inputImages, tasks, callCount]);

  const { guardedAction, discardDialogProps } = useUnsavedChanges(isDirtyRef);

  function handleNew() {
    guardedAction(() => {
      if (imageId) navigate('/image');
      else resetToBlank();
    });
  }

  function handleSave() {
    const content = buildImageGenContentString(prompt, inputImages, tasks, callCount);
    if (imageId && recordQuery.data) {
      updateRecord.mutate(
        { ...(recordQuery.data as ImageGenRecord), name, content },
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
    const content = buildImageGenContentString(prompt, inputImages, tasks, callCount);
    createRecord.mutate(
      { name: newName, content },
      {
        onSuccess: (doc) => {
          setName(newName);
          lastSaved.current = { name: newName, content };
          isDirtyRef.current = false;
          clearDraft();
          navigate(`/image/${doc._id}`, { replace: true });
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

  function handleTaskChange(taskId: string, patch: Partial<ImageGenTask>) {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }

  function handleAddTask() {
    if (tasks.length >= runGuard.maxTasks) return;
    setTasks([...tasks, createImageGenTask()]);
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
  const hasPrompt = prompt.trim().length > 0;
  const activeTasks = tasks.filter((task) => !task.excluded);
  const modelsReady = activeTasks.length > 0 && activeTasks.every((task) => task.model.trim().length > 0);
  const startDisabled = !providerReady || !hasPrompt || !modelsReady || isRunning;

  async function handleStart() {
    if (!activeProvider?.apiKey || !modelsReady || !hasPrompt) return;
    const provider = activeProvider;
    const inputImageDataUrls = inputImages.map((image) => image.dataUrl);

    // A model with no "image" input modality can't accept inputImageDataUrls; sending it
    // anyway fails with an opaque "model not available" error from the provider. Skip that
    // task's calls locally instead, so one unsupported model doesn't block the whole run.
    const skippedTaskIds = new Set(
      activeTasks
        .filter(
          (task) => inputImageDataUrls.length > 0 && optionsById.get(task.model)?.supportsImageInput === false,
        )
        .map((task) => task.id),
    );
    for (const task of activeTasks) {
      if (skippedTaskIds.has(task.id)) {
        toast.error(`Skipped ${task.model} — this model does not accept image input`);
      }
    }

    if (isRunning || !await runGuard.approve({ taskCount: tasks.length, activeTaskCount: activeTasks.length, callCount,
      payloads: activeTasks.map((task) => ({ ...task, prompt, inputImageDataUrls })) })) return;

    const resultsSnapshot: Record<string, ImageGenCallResult[]> = { ...resultsByTaskId };
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

    const runners = jobs.map(({ taskId }) => async (): Promise<ImageGenCallResult> => {
      const task = activeTasks.find((t) => t.id === taskId)!;
      if (skippedTaskIds.has(taskId)) {
        return { success: false, error: 'Skipped — this model does not accept image input', durationMs: 0 };
      }
      const start = performance.now();
      try {
        const data = await submitImageGeneration({
          serverURL: provider.serverURL,
          apiKey: provider.apiKey,
          model: task.model,
          prompt,
          inputImageDataUrls,
          aspectRatio: task.aspectRatio,
          resolution: task.resolution,
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
        loadPath="/image/records"
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
                Prompt
              </Heading>
              <TextArea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the image to generate"
                rows={4}
              />
            </Box>

            <Box>
              <Heading size="3" mb="2">
                Input images
              </Heading>
              <ImagePicker images={inputImages} onChange={setInputImages} />
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
            <ImageGenTasksTable
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
