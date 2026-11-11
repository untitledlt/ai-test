# ai-test-agent (standalone) — implementation reference

This document describes the **as-built** standalone `ai-test-agent` app — a local-first rebuild of
the `ai-test/agent` feature from the `home` React app. It reflects the current implementation in
`src/`, not a forward-looking spec: when this doc and the code disagree, the code is correct and this
file should be updated to match. Architectural decisions recorded here were made deliberately — don't
deviate from them without checking with the user first.

## 1. Purpose

A local-first, multi-user tool for testing LLM chat-completion prompts against OpenRouter (or any
other server exposing an OpenAI-compatible `/chat/completions` schema). It lets a user:

- Compose a chat-completion request (`messages` + optional `tools`) and submit it directly from the
  browser to a configured LLM provider, with per-call `model`, `temperature`, `reasoningEffort`, and
  `maxTokens`.
- Save/load/rename/delete named "records" (a saved prompt) locally, offline, via PouchDB — there is
  **no backend server** for this app.
- Run a saved prompt as a **batch**: multiple "tasks" (each a model + temperature + reasoning-effort +
  max-tokens combination), N calls per task, concurrently, and compare token usage / cost / latency
  across tasks. Every run is kept as a timestamped history snapshot, not just the latest one.
- Write a small JS test-suite (Jest-like `expect()` API) that runs trusted code in a Web Worker against
  each batch response and reports pass/fail per check.
- Configure multiple named provider profiles (label + server URL + API key) and switch between them,
  so the same UI works against OpenRouter, a self-hosted OpenAI-compatible server, etc.
- Build up a list of previously-used model strings as autocomplete suggestions, persisted locally
  (no hardcoded model list).

## 2. Stack (do not substitute)

| Concern | Decision |
|---|---|
| Scaffold | Vite + React 19 + TypeScript, SPA (no SSR) |
| Package manager | yarn |
| Routing | `react-router-dom` v7, client-side only, stable `useBlocker`. Routes: `/`, `/records`, `/settings`, `/:recordId`, `/:promptId/multiple` (legacy redirect only, see §6.1) |
| UI components | **Radix Themes** (`@radix-ui/themes`) plus an internal shared package, **`@untitled/ui-kit`** (`packages/ui-kit`, bundled Yarn workspace), which supplies the app's `AppTheme` wrapper (Radix theme tokens — indigo on slate), a `JsonEditor` (CodeMirror-based JSON editor/viewer component), a `DockPanel` (bottom resizable-panel chrome), and the `useResizableHeight` drag-resize hook. Use `ui-kit` for these rather than re-implementing them locally |
| Icons | `lucide-react` |
| Custom CSS | Plain CSS Modules (`*.module.css`) for anything Radix Themes/ui-kit don't cover — no styled-components, no Tailwind |
| Code/JSON editor | Two call sites: `@untitled/ui-kit`'s `JsonEditor` for the main payload editor (`record-page.tsx`) and the read-only raw-result JSON view (`result-panel.tsx`); raw `@uiw/react-codemirror` + `@codemirror/lang-javascript`/`@codemirror/lang-json` directly in `bottom-panel.tsx` for the batch test-suite JS editor and the raw-response JSON editor |
| LLM client | `@openrouter/sdk`. `new OpenRouter({ apiKey, serverURL })` — `serverURL` points at the active provider profile's server, so the same SDK call works against OpenRouter or any OpenAI-schema-compatible server. There is no second bespoke fetch client |
| Local storage | PouchDB (`pouchdb-browser`), one local database named `ai-test-agent`, IndexedDB-backed. See §4 for schema. A few small "last used" UI preferences (editor mode, last model/temperature/reasoning-effort/max-tokens) live in `localStorage` instead, not PouchDB — see §6.1 |
| Data fetching/caching | `@tanstack/react-query` as a thin cache/mutation layer over PouchDB calls (`queryFn`/`mutationFn` wrap the `getDoc`/`putDoc`/`removeDoc`/`allDocsByPrefix` helpers in `db/client.ts`) |
| Remote sync (optional) | PouchDB's `.sync()` to a user-specified remote CouchDB/PouchDB-Server URL, off by default (see §4.4) |
| Test-suite execution | Native Web Worker + `new Function()` (see §7) |
| Concurrency for batch calls | Hand-rolled worker-pool helper (`lib/batch-runner.ts`), no external queue library |
| Testing | Vitest + Testing Library (`jsdom`), `fake-indexeddb` for PouchDB in tests. Components/hooks/lib modules each have a colocated `*.test.ts(x)` file |

## 3. Project structure

```
ai-test-agent/
  src/
    main.tsx
    app.tsx                    # AppTheme (ui-kit), QueryClientProvider, RouterProvider; seeds AppSettings + sync on mount
    router.tsx                 # react-router-dom route table
    db/
      client.ts                # PouchDB instance + typed getDoc/putDoc/removeDoc/allDocsByPrefix helpers
      types.ts                 # AgentRecord, ProviderProfile, AppSettings, CustomModel doc types
    hooks/
      use-records.ts           # useRecords(), useRecord(id), useCreateRecord(), useUpdateRecord(), useDeleteRecord()
      use-providers.ts         # useProviders(), useAppSettings(), useActiveProvider(), useSaveProvider(), useDeleteProvider(), useSetActiveProvider(), getOrCreateAppSettings()
      use-sync-settings.ts     # useSyncSettings(), useUpdateSyncSettings(), ensureSyncMatchesSettings() — remote CouchDB sync
      use-completion.ts        # useCompletion() — single call, mirrors useMutation shape
      use-models.ts            # useCustomModels(), useAddCustomModel(), useDeleteCustomModel() — persisted model autocomplete entries
    lib/
      seed-data.ts             # seedInitialData() — one-time provider + "prison" record seed into an empty db, see §4.2
      openrouter-client.ts     # submitCompletion({ serverURL, apiKey, model, messages, tools, temperature?, reasoningEffort?, maxTokens? })
      payload-utils.ts         # parsePayload, isToolDefinition, buildAppendMessagesFromChoice, formatToolCall, findToolCallById
      batch-runner.ts          # runWithConcurrency
      test-runner.ts           # TestRunner class (owns/recycles the worker)
      test-worker.ts           # trusted-code expect() suite runner (Web Worker entry)
      multiple-call-utils.ts   # createDefaultTask, DEFAULT_TEST_SUITE, migrateLegacyRecord (legacy multipleResults -> history)
      models.ts                # DEFAULT_MODEL (empty string — no hardcoded suggestion list, see §11)
      reasoning-effort.ts      # REASONING_EFFORT_OPTIONS — shared by single-call and multi-call UIs
      format.ts                # formatTokens, formatCost, formatDuration, formatDateTime, maskApiKey
    types.ts                   # Message, ToolCall, ToolDefinition, Payload, Choice, Usage, CompletionResult,
                                # ReasoningEffort, BatchTask, BatchCallResult, CheckResult, MultipleResultsSnapshot
    pages/
      record-page.tsx          # "/" and "/:recordId" — single-call editor AND multi-call batch runner, as tabs (see §6.1)
      records-page.tsx         # "/records"
      settings-page.tsx        # "/settings" — provider profiles + sync settings
      legacy-multiple-redirect.tsx  # "/:promptId/multiple" -> redirects to "/:promptId?tab=multiple"
    components/
      toolbar.tsx              # New / Load / Save / Save As + settings gear
      form-editor.tsx          # Form-mode message list + tools list for the single-call editor
      message-block.tsx        # One message row in form mode
      tool-card.tsx             # One structured tool-definition editor (name/description/typed properties)
      result-panel.tsx         # Single-call result: stats + human-readable/raw-JSON toggle
      save-as-dialog.tsx
      model-autocomplete.tsx   # Free-text model field backed by useCustomModels()
      multiple-toolbar.tsx     # Batch tab toolbar: call count, add task, start, history selector
      multiple-tasks-table.tsx # Per-task controls + response/stats grid for the batch tab
      bottom-panel.tsx         # Resizable dock: test-suite editor + raw-response viewer (batch tab)
      provider-settings-dialog.tsx
      submit-loading-overlay.tsx  # Full-pane spinner + elapsed-time readout while a single call is pending
    styles/
      global.css
    test/
      render.tsx, setup.ts     # shared test render helper + jsdom/fake-indexeddb setup
  index.html
  vite.config.ts                # vitest config lives here too (environment: jsdom, worker format: 'es')
  package.json
  tsconfig.json / tsconfig.app.json / tsconfig.node.json
  eslint.config.js
```

Notable deviations from a naive reading of "one page per route": there is **no** separate
`multiple-page.tsx` or `editor-page.tsx` — both single-call and multi-call UIs live in
`record-page.tsx` as tabs (see §6.1). There is no local `json-editor.tsx` or `resizable-panel.tsx` —
those are provided by `@untitled/ui-kit` (`JsonEditor`, `DockPanel`, `useResizableHeight`).

## 4. Data model (PouchDB)

One local PouchDB database, name `ai-test-agent`. Documents are distinguished by an `_id` prefix and a
`type` field. No Mango index — list views use `allDocsByPrefix(prefix)` (an `allDocs({ startkey,
endkey })` range query) then sort client-side.

### 4.1 `AgentRecord` — `_id: record:<uuid>`

```ts
type AgentRecord = {
  _id: string;
  _rev?: string;
  type: 'record';
  name: string;
  content: string;                              // JSON string of { messages, tools? }
  multipleTasks?: BatchTask[];
  multipleCallCount?: number;
  multipleTestSuite?: string;
  multipleResultsHistory?: MultipleResultsSnapshot[];
  /** @deprecated pre-history single-snapshot field; migrated on read, see lib/multiple-call-utils.ts */
  multipleResults?: string;
  createdAt: string;
  updatedAt: string;
};
```

The batch state is **not** one JSON blob overwritten on every run. Each "Start" run appends a new
`MultipleResultsSnapshot` (`{ id, createdAt, tasks, callCount, results }`) to the front of
`multipleResultsHistory`, and the multi-call tab's toolbar has a history `Select` ("Live results" +
one entry per past run, newest first) to view any past run read-only. Older records saved before this
existed may still carry the deprecated `multipleResults` string; `migrateLegacyRecord()` parses it
into a single history entry on read so old saves keep working.

- Create: generate `_id`, set `createdAt = updatedAt = new Date().toISOString()`.
- Update: `putDoc()` with the existing `_rev`, bump `updatedAt`.
- Delete: `removeDoc()`.
- List (records page): `allDocsByPrefix<AgentRecord>('record:')`, sorted by `updatedAt` descending in
  memory. Fetches full docs (PouchDB reads are cheap) and just doesn't render `content` in the table.
- The same first-run seed described in §4.2 also creates one record (`name: 'prison'`) — a
  prompt-injection test fixture: a system prompt describing prisoners' PIN codes with instructions not
  to disclose them, an `unlock_door` tool, and a user message probing for a leak. `seedInitialData()`
  also writes `localStorage['ai-test-agent:last-model'] = 'google/gemini-3.1-flash-lite'` on that same
  first run, so the editor's model field (see §6.1) reflects it — the model isn't stored on the record
  itself, since `AgentRecord` has no `model` field.

### 4.2 `ProviderProfile` — `_id: provider:<uuid>`

```ts
type ProviderProfile = {
  _id: string;
  _rev?: string;
  type: 'provider';
  label: string;          // e.g. "OpenRouter", "Local vLLM"
  serverURL: string;      // passed as `serverURL` to `new OpenRouter({ apiKey, serverURL })`
  apiKey: string;
  createdAt: string;
  updatedAt: string;
};
```

- Seeding (both the provider and the initial record below) is handled by `lib/seed-data.ts`'s
  `seedInitialData()`, called once from `App`'s mount effect (`app.tsx`) — not lazily from a hook.
  It only acts on a truly empty local database (zero `provider:` docs **and** zero `record:` docs); if
  either collection already has anything in it, it's a no-op. On an empty db it creates one
  active `OpenRouter` profile (`serverURL: 'https://openrouter.ai/api/v1'`, `apiKey: ''`).
  No dummy credentials or local development provider are seeded. Concurrent startup calls share
  an in-flight seed promise, and App invalidates cached queries after seeding. The user manages
  providers via the Settings page — never `window.prompt()`.

### 4.3 `AppSettings` — singleton, `_id: 'app-settings'`

```ts
type AppSettings = {
  _id: 'app-settings';
  _rev?: string;
  type: 'settings';
  activeProviderId: string | null;
  syncRemoteURL?: string;
  syncEnabled?: boolean;
};
```

`getOrCreateAppSettings()` fetches it, creating it with defaults (`activeProviderId: null,
syncEnabled: false`) on a 404.

### 4.4 `CustomModel` — `_id: model:<uuid>`

```ts
type CustomModel = {
  _id: string;
  _rev?: string;
  type: 'model';
  value: string;          // e.g. "anthropic/claude-sonnet-5" — free text, nothing validates it
  createdAt: string;
};
```

Not in scope originally — this replaces a hardcoded suggestion list entirely (see §11). Whenever the
user blurs `ModelAutoComplete` with a value that isn't already a known custom model, it's persisted via
`useAddCustomModel()` so it reappears as a suggestion in future sessions/records. `model-autocomplete.tsx`
also lets the user delete a suggestion inline (`useDeleteCustomModel()`).

### 4.5 Optional remote sync

- Settings page (`/settings`) has a "Sync" section: a text field for a remote CouchDB/PouchDB-Server
  URL and a switch. `useUpdateSyncSettings()` persists the fields to `AppSettings` and calls
  `ensureSyncMatchesSettings()`, which calls `db.sync(remoteUrl, { live: true, retry: true, filter: shouldSyncDocument })` when
  enabled (keeping the handle in a module-level variable in `use-sync-settings.ts` so it can be
  cancelled/restarted) or cancels it otherwise. `app.tsx` also calls this once on mount so sync resumes
  across reloads. Sync errors/denials surface via `sonner` toasts; they're non-fatal.
- Provider profiles and `app-settings` stay local in both replication directions, including deletion tombstones.
  The sync URL may contain credentials, so connection settings must be configured separately on each device.
- Off by default; the app works fully offline regardless of sync state.

## 5. Provider settings

- `/settings` (`pages/settings-page.tsx`, a dedicated route, not a modal) lists provider profiles in a
  Radix `Table` wrapped in a `RadioGroup.Root` (the radio column is the "Active" selector — picking a
  row calls `useSetActiveProvider()` immediately): label, server URL (truncated with ellipsis), API key
  (masked via `maskApiKey()`, e.g. `sk-o••••1234`, or "Not set"), edit/delete `IconButton`s.
- "Add profile" / editing both open `ProviderSettingsDialog` (a Radix `Dialog` with label/server
  URL/API key `TextField`s); the API key field is `type="password"`. Save is disabled until label and
  server URL are non-blank.
- Deleting a provider that's currently active clears `AppSettings.activeProviderId` back to `null`
  (`useDeleteProvider()`).
- If there's no active provider or its `apiKey` is empty, both `/settings` and the editor show an amber
  `Callout`: "Configure a provider in Settings before submitting." / "Configure an active provider with
  an API key before submitting." The editor's Submit button and the batch tab's Start button are both
  disabled in this state. Never falls back to `window.prompt()`.
- The Sync section (§4.5) lives on the same page, below the providers table.

## 6. Pages

### 6.1 Record page — `/` (new record) and `/:recordId` (edit existing)

One component (`RecordPage`) renders **both** the single-call editor and the multi-call batch runner,
switched by a top `SegmentedControl` ("Single call" / "Multiple calls"). This replaced an earlier plan
of two separate pages/routes:

- The initial tab is read once from `?tab=multiple` in the URL (`useSearchParams`, read only in the
  `useState` initializer). After that, switching tabs is **plain local state** — it intentionally does
  not call `setSearchParams`/`navigate`, so a tab switch is never seen as "leaving the page" by the
  unsaved-changes blocker (see below), and in-memory multi-call state survives switching back to
  single-call and back.
- `/:promptId/multiple` still exists as a route, but only as `LegacyMultipleRedirect`, which immediately
  `<Navigate>`s to `/:promptId?tab=multiple` — kept so old bookmarks/links still land somewhere useful.

**Single-call state**: `name`, `content` (raw JSON string of `{ messages, tools? }`), `mode: 'editor' |
'form'`, `model`, `temperature`, `reasoningEffort`, `maxTokens`, `result`, `durationMs`,
`saveAsOpen`, `pendingSubmitPayload` (set when the submit confirmation dialog is showing). `mode` and
all four single-call model parameters are persisted to `localStorage`
(`ai-test-agent:editor-mode`, `:last-model`, `:last-temperature`, `:last-reasoning-effort`,
`:last-max-tokens`) as "last used" convenience across records/sessions — this is separate from the
PouchDB record itself, which does not store these fields.

**Multi-call state**: `tasks: BatchTask[]`, `callCount`, `testSuite`, `resultsByTaskId`,
`testResultsByTaskId`, `progressByTaskId`, `isRunning`, `isRunningTests`, `history:
MultipleResultsSnapshot[]`, `historySelection` (`'live'` or a snapshot id).

- **Dirty tracking**: an `isDirtyRef` (not state) is recomputed in a plain `useEffect` with no
  dependency array, comparing `name`/`content`/`JSON.stringify(tasks)`/`callCount`/`testSuite` against
  a `lastSaved` ref snapshot. `react-router-dom`'s stable `useBlocker(shouldBlock)` blocks navigation
  while dirty, showing an `AlertDialog` ("Unsaved changes" / Leave / Stay). In-app guarded actions (New)
  go through the same `isDirtyRef` via a local `guardedAction()` helper and share the same dialog. The
  dirty ref is set to `false` synchronously right before `navigate()` after a successful create/save so
  the blocker doesn't re-fire on the save's own navigation.
- **Keyboard shortcuts** (global `keydown` listener, re-registered every render so closures stay
  fresh): Cmd/Ctrl+Enter submits (single-call tab only, only when a provider is configured and no call
  is already pending); Cmd/Ctrl+S saves (`handleSave()`, works from either tab). Both call
  `preventDefault()`.
- **Toolbar** (`components/toolbar.tsx`): New, Load (→ `/records`), Save, Save As, record name (center,
  truncated), and a settings gear `IconButton` (→ `/settings`). Model/temperature/reasoning-effort/
  max-tokens fields and the Submit button are **not** in `Toolbar` — they're in the tab row directly
  below it, shown only for the single-call tab; the multi-call tab shows `MultipleToolbar` in that same
  row instead.
- **Two-pane split layout** (single-call tab): left pane = editor (JSON or Form mode via
  `SegmentedControl`), right pane = `ResultPanel` (or its own "Submit to see a result" placeholder).
- **Editor mode**: `@untitled/ui-kit`'s `JsonEditor` bound to `content`, plus "Copy JSON" (clipboard)
  and "Clear" (`onChange('{}')`) buttons above it. Validity is a plain `JSON.parse` check on
  Submit/Save (`parsePayload` returns `null` rather than throwing); invalid JSON shows a toast
  ("Payload is not valid JSON").
- **Form mode** (`FormEditor`): if `content` doesn't parse, shows a red `Callout` telling the user to
  fix it in Editor mode first. Otherwise renders one `MessageBlock` per message (role `Select`:
  system/user/assistant/tool; remove button; a `TextArea` for content, skipped when the message has
  `tool_calls` and no content) plus "Add message" (`{ role: 'user', content: '' }`). Tool messages with
  a `tool_call_id` show the originating call (looked up via `findToolCallById`) formatted with
  `formatToolCall`; assistant messages with `tool_calls` render each call the same way.
  Below the messages, tools are edited as a list of **`ToolCard`** components — not a raw JSON textarea.
  Each `ToolCard` is a collapsible card with Name/Description text fields and a dynamic list of typed
  properties (name, a `Select` of `ToolPropertyType` — `'string' | 'number' | 'integer' | 'boolean' |
  'object' | 'array'` — description, and a required `Checkbox`), converting to/from a `ToolDefinition`
  via `draftToTool`/`toolToDraft` in `tool-card.tsx`. "Add tool" appends a blank, auto-expanded card.
- **Submit**: parses `content`; invalid JSON shows a toast. If the last message's role is `'assistant'`,
  shows a confirmation `AlertDialog` ("Last message is not from the user" / Submit anyway) before
  calling `useCompletion().mutate({ model, messages, tools, temperature, reasoningEffort, maxTokens },
  { onSuccess, onError })`. `durationMs` is measured client-side around the call. A full-pane
  `SubmitLoadingOverlay` (spinner + running elapsed-seconds readout) shows while the mutation is
  pending.
- **Save / Save As**: validates JSON first. With a `recordId`, Save updates in place (name + content +
  all multi-call fields) and toasts "Saved". Without one, Save opens `SaveAsDialog` (name field, Save
  disabled while blank); on success it navigates to `/:recordId` (replacing history) and marks the form
  clean.
- **Result panel** (`ResultPanel`): stats row (prompt tokens, total tokens, cost as `$0.000000` or `—`,
  duration as `Nms`/`N.NNs`), a `SegmentedControl` between "Human readable" (content card, one card per
  tool call via `formatToolCall`, an italic "Reasoning" card if present) and "Raw JSON" (read-only
  `ui-kit` `JsonEditor` of `choices[0]`), and an "Append to messages" button
  (`buildAppendMessagesFromChoice` + re-serialize `content` with 2-space indent).

### Multi-call (batch) tab

Rendered inline in `RecordPage` when the tab is `'multiple'`; it only runs the record's already-saved
`content` (never edits the prompt). Requires `recordId` to exist — if the record hasn't been saved yet,
Start is disabled and a gray `Callout` prompts to save first.

- **Task** shape: `{ id, model, temperature, reasoningEffort?: ReasoningEffort, maxTokens?: number,
  excluded?: boolean }`. `createDefaultTask()` defaults to `{ model: DEFAULT_MODEL, temperature: 0.7,
  excluded: false }` (no default `reasoningEffort`/`maxTokens` — both mean "unset/no limit").
- **State hydration**: `migrateLegacyRecord(record)` reads `multipleTasks`/`multipleResultsHistory`
  directly when present; otherwise it migrates the deprecated single `multipleResults` JSON string into
  one history entry; otherwise it returns one default task, `callCount: 1`, the default test suite, and
  empty history. The *live* `resultsByTaskId` is seeded from the latest history snapshot (if any) so a
  freshly-opened record shows its last run's results immediately.
- **`MultipleToolbar`**: "Calls per task" number field (clamped 1–20), "Add task", "Start" (disabled
  while running or if `startDisabled` — no `recordId` yet), and, when `history.length > 0`, a `Select`
  of past runs ("Live results" + each snapshot labeled by `formatDateTime(createdAt)`, newest marked
  "(latest run)"). Picking a past run switches the whole tab to a read-only view of that snapshot
  (`readOnly` prop on `MultipleTasksTable` disables every control); picking any task/call-count control
  while a snapshot is selected snaps `historySelection` back to `'live'` first.
- **`MultipleTasksTable`** (custom, not a plain Radix `Table` — needs a sticky label column and
  per-cell controls): header row = "Task N" + remove button + "Excluded"/progress (`done/total`)
  badges. Body rows, top to bottom: Exclude checkbox, Model (`ModelAutoComplete`), Temperature (number,
  step 0.1, 0–2), Reasoning effort (`Select`, options from `REASONING_EFFORT_OPTIONS`:
  Default/X-High/High/Medium/Low/Minimal/None), **Max tokens** (number, step 1, min 1, blank = "No
  limit"), Avg tokens/price/time per call (computed client-side from that task's results — tokens via
  `total_tokens`, price only across calls that reported a `usage.cost`, time across *all* settled calls
  including failures), Tests summary (`passed/total passed`, colored red if any failed), then one
  `Response #N` row per call index. Excluded tasks get a dimmed column (`excludedCol` CSS class) but
  keep prior results visible; their controls stay interactive except mid-run.
  - A response cell shows `—` if no result yet, a red error block if that call failed, or the message
    content (monospace) + each tool call via `formatToolCall` if it succeeded, plus, once tests have
    run, a green "✓ name" line per passing check and a `<details>` disclosure per failing check.
- **Start** (`handleStart`): requires `content` to parse, at least one non-excluded task, and the
  active provider to have an API key (else a toast and no-op). Clears stale per-call test results for
  all non-excluded tasks, builds one job per (active task × `callCount`), and runs them through
  `runWithConcurrency(jobs, 5, onSettle)` (concurrency hard-coded to 5) — `onSettle` updates
  `resultsByTaskId` and the progress badges incrementally as each call lands, not just at the end. Each
  job calls `submitCompletion` with that task's `model`/`temperature`/`reasoningEffort`/`maxTokens` and
  the record's `messages`/`tools`, catching failures into `{ success: false, error, durationMs }`.
  Excluded tasks' prior results are left untouched. After all jobs settle, a new
  `MultipleResultsSnapshot` is prepended to `history` and the whole batch state (`multipleTasks`,
  `multipleCallCount`, `multipleTestSuite`, `multipleResultsHistory`) is persisted via
  `useUpdateRecord()` automatically — no separate save step is required after a run.
- **`BottomPanel`**: a `ui-kit` `DockPanel` (drag-resizable, `useResizableHeight(320, { min: 160, grow:
  'up' })`) with `Tabs`: "Test suite" (raw `CodeMirror` + `javascript()` extension, bound to
  `testSuite`) and "Raw response" (raw `CodeMirror` + `json()` extension, read-only, showing
  `{ tasks, callCount, results, testSuite }` for whichever of live/selected-history is displayed). "Run
  tests" only appears on the Test suite tab. Default test suite source:
  ```js
  return [
    {
      name: 'has content or tool_calls',
      fn: (message) => expect(message.content || message.tool_calls).toBeTruthy(),
    },
  ];
  ```
- **Run tests** (`handleRunTests`): collects one job per successful call across the currently displayed
  tasks (`{ taskId, callIndex, message }`), skipping unsuccessful/missing results. Errors with a toast
  ("No responses to test yet — run a batch first.") if there's nothing to test. Otherwise runs them
  through `TestRunner.runSuite` (sequential, see §7), updating `testResultsByTaskId[taskId][callIndex]`
  incrementally as each result streams back.
- There is no separate manual "save raw JSON" action distinct from the auto-persist after Start in the
  current implementation — the Raw response tab is a read-only view of the persisted/live state, not an
  editable one merged back in on a button press.

### 6.2 Records page — `/records`

- A search `TextField` (with a search icon slot) filters the list by name, case-insensitive substring,
  live as you type.
- A Radix `Table`: Name, Updated (`formatDateTime` → `YYYY-MM-DD HH:mm`), and a delete `IconButton`
  (red) per row opening an `AlertDialog` ("Delete record "<name>"? This cannot be undone."). Clicking a
  row (not the delete button) navigates to `/:recordId`. Loading and "No records found." empty states.

## 7. Trusted test-suite execution

Security-sensitive (arbitrary code execution): run only trusted test-suite code. A Web Worker
has no DOM or localStorage, but **can access IndexedDB (including saved API keys) and the network**.
It isolates work from the UI thread, not from the app's data. The test editor shows this warning.
Remote sync excludes provider profiles (including API keys) and connection settings in both directions via `db/sync-filter.ts`,
but still replicates test suites. Previously synced remote credentials are not removed; rotate affected keys/database passwords. Settings explains this before the sync controls.

- `test-worker.ts` (Worker entry point): implements a minimal Jest-like `expect(actual)` with `.toBe`,
  `.toEqual` (deep via `JSON.stringify` comparison), `.toContain` (array or substring), `.toMatch`
  (string or RegExp), `.toBeTruthy`, `.toBeFalsy`, `.toBeDefined`, `.toBeGreaterThan(n)`,
  `.toBeLessThan(n)`, each throwing a custom `AssertionError` with a descriptive message on failure. On
  `{ type: 'run', requestId, suiteSource, message }`: builds the suite via `new Function('expect',
  suiteSource)(expect)` (expected to `return` an array of `{ name, fn }`), runs each check's
  `await fn(message)`, catching per-check errors into `{ name, pass, message? }`, and posts back `{ type:
  'result', requestId, checks }`. A suite-build-time error posts back `{ type: 'error', requestId,
  error }` instead. Malformed suite return values are rejected with a descriptive error.
- `test-runner.ts`'s `TestRunner` class owns one worker instance, reused across calls in a run, but runs
  jobs **sequentially** (`runSuite` awaits each job in turn) so results stream back to the UI in a
  predictable order. Each job gets a 2-second timeout; on timeout the stuck worker is `terminate()`d and
  replaced (`createWorker()`), and the job resolves as one failing check named `(suite)` with "Timed out
  after 2000ms". Terminating the runner settles pending work without creating a replacement; worker
  errors report a failed suite immediately. Requests are matched to responses via a per-instance `requestId` counter.

## 8. Shared payload utilities (`lib/payload-utils.ts`)

- `parsePayload(raw: string): AiTestAgentPayload | null` — `JSON.parse`, returns `null` (not throw) if
  invalid, message/tool-call fields have unsupported shapes, or `tools` is present but is not an array.
- `isToolDefinition(value): value is ToolDefinition` — type guard used by `FormEditor`/`ToolCard` (type
  `'function'`, a string `function.name`, and only the simple schema fields representable by the form). Advanced schemas remain editable as JSON and are preserved during form message edits.
- `buildAppendMessagesFromChoice(choice)` — see §6.1 "Append to messages".
- `formatToolCall(call)` — parses `call.function.arguments` as JSON and renders
  `functionName({ key: 'value', other: 123 })`; string values are single-quoted with `\` and `'`
  escaped; falls back to `functionName(<raw arguments string>)` if arguments aren't valid JSON.
- `findToolCallById(messages, toolCallId)` — scans all messages' `tool_calls` arrays for a matching id.

## 9. Core types (`types.ts`) — OpenAI-compatible chat-completion schema, provider-agnostic

```ts
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type Message = {
  role: MessageRole | string;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolPropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: ToolPropertyType; description?: string }>;
      required?: string[];
    };
  };
};

type AiTestAgentPayload = { messages: Message[]; tools?: unknown[] };

type Choice = {
  index: number;
  finish_reason: string | null;
  message: { role: string; content: string | null; reasoning?: string | null; tool_calls?: ToolCall[] };
};

type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number; cost?: number };

type CompletionResult = { id: string; model: string; choices: Choice[]; usage: Usage };
type AiTestAgentResult = CompletionResult;

type ReasoningEffort = 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';

type BatchTask = {
  id: string;
  model: string;
  temperature: number;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  excluded?: boolean;
};

type BatchCallResult =
  | { success: true; data: CompletionResult; durationMs: number }
  | { success: false; error: string; durationMs: number };

type CheckResult = { name: string; pass: boolean; message?: string };

/** @deprecated legacy single-snapshot shape, kept only to migrate old `multipleResults` JSON on read */
type MultipleResultsState = { tasks: BatchTask[]; callCount: number; results: BatchCallResult[][]; testSuite: string };

type MultipleResultsSnapshot = { id: string; createdAt: string; tasks: BatchTask[]; callCount: number; results: BatchCallResult[][] };
```

This shape stays provider-agnostic because it matches the OpenAI/OpenRouter chat-completions
request/response contract directly: any server matching it works, given the right `serverURL` +
`apiKey`.

## 10. LLM client (`lib/openrouter-client.ts`)

```ts
export type SubmitCompletionParams = {
  serverURL: string;
  apiKey: string;
  model: string;
  messages: Message[];
  tools?: unknown[];
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
};

export async function submitCompletion(params: SubmitCompletionParams): Promise<CompletionResult> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });
  // toChatMessage()/fromChatResult() convert to/from the SDK's ChatMessages[]/ChatResult shape:
  // prompt_tokens/completion_tokens/total_tokens/cost <-> promptTokens/completionTokens/totalTokens/cost,
  // finish_reason <-> finishReason, tool_calls <-> toolCalls, reasoning effort passed as
  // `reasoning: { effort: reasoningEffort }`, max tokens passed as `maxTokens`, stream: false always.
}
```

`useCompletion()` (the React Query mutation hook, in `hooks/use-completion.ts`) resolves
`serverURL`/`apiKey` from the active provider profile before calling `submitCompletion`, throwing
"Configure a provider in Settings before submitting." if there is none or its `apiKey` is empty,
instead of calling the SDK.

## 11. Model autocomplete (`lib/models.ts`, `hooks/use-models.ts`, `components/model-autocomplete.tsx`)

There is **no hardcoded model suggestion list**. `lib/models.ts` exports only `DEFAULT_MODEL = ''`.
Suggestions come entirely from `CustomModel` PouchDB docs (§4.4): `ModelAutoComplete` is a free-text
`TextField` + Radix `Popover` dropdown filtered by the current input against `useCustomModels()`'s
list; on blur, if the typed value is non-empty and not already known, `useAddCustomModel()` persists it
so it appears as a suggestion from then on. Each suggestion row also has an inline delete button
(`useDeleteCustomModel()`). The model field always accepts arbitrary free text regardless of what's
suggested — nothing validates it against the list.

## 12. Explicitly out of scope

- No authentication/user accounts — single-user local tool.
- No backend server of any kind — all persistence is PouchDB in the browser; remote CouchDB sync is
  optional and only for backup/multi-device, never required for the app to function.
- No data migration/import from any other app.
- No PWA/offline-install manifest, no service worker.
- No streaming responses — every call is a single non-streamed request/response.

## 13. Commands

```bash
yarn install
yarn dev            # vite dev server on :5174 (see vite.config.ts)
yarn build          # tsc -b && vite build
yarn preview
yarn test           # vitest run
yarn test:watch     # vitest (watch mode)
yarn lint           # eslint .
```

Note: `@untitled/ui-kit` is bundled at `packages/ui-kit` as a Yarn workspace; no private
GitHub access is required. Production builds emit root `LICENSE` and `THIRD_PARTY_LICENSES.md`.

## 14. Acceptance checklist

1. Fresh clone → `yarn && yarn dev` → app loads at `/` with an empty new-record editor, no console
   errors, no network calls made until Submit is pressed. → verify: manual smoke test.
2. Settings → add a provider profile with a real OpenRouter key → mark active → Submit a simple
   `{"messages":[{"role":"user","content":"say hi"}]}` payload → a result renders with token/cost
   stats. → verify: manual, one real call.
3. Save a record, reload the page (hard refresh) → record still present in `/records` (proves
   PouchDB/IndexedDB persistence survives reload). → verify: manual.
4. Open a saved record's Multiple-calls tab, add a second task, set callCount to 2, Start → both tasks
   show 2/2 progress and populated response cells; reload the page → results are still shown (proves
   `multipleResultsHistory` persistence). → verify: manual.
5. Run the default test suite against those results → each response row shows a pass/fail check.
   → verify: manual.
6. `yarn build` completes with no TypeScript errors. → verify: `tsc --noEmit -p tsconfig.app.json` /
   CI.
7. `yarn test` passes (component/hook/lib unit tests under Vitest). → verify: CI/local.


## Public distribution

- `@untitled/ui-kit` source is bundled at `packages/ui-kit`, based on v0.1.0. Yarn workspaces
  preserve its package imports; Vite compiles its source directly. Do not restore the private GitHub dependency.
- Node.js 24.15+ in the 24.x line (or 26+) and Yarn 1.22.22 are required. The bundled package is
  covered by root lint, type-check, and test commands. GitHub Actions runs the release checks.
- The Vite base path defaults to `/ai-test/`; set `APP_BASE_PATH=/llm-test/` for a different deployment path.
  The router uses `import.meta.env.BASE_URL`. Static hosts must provide SPA fallback.
- The development server binds locally by default. Deployment requires an explicit `DEPLOY_TARGET`;
  no SSH destination is hardcoded in package scripts. See README.md and SECURITY.md for setup and trust boundaries.
- Model and pricing caches include the provider revision and only fetch when an API key is present,
  so editing a provider refreshes discovery without embedding credentials in query keys.
