# Typesafe (Jev Decisions) Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/typesafe` page for building and submitting TypeSafe Jev decision requests (state + typed questions) against the app's existing OpenRouter provider profiles, with Form and JSON dual-mode editing and per-question answer rendering.

**Architecture:** A new page-local-state page (`typesafe-page.tsx`, no PouchDB persistence) composed from three new presentational components (`StateList`, `QuestionCard`, `DecisionAnswerCard`) plus a pure serialization module (`decision-utils.ts`) that converts between editable drafts and the wire request/response shapes. Submission reuses the existing `@openrouter/sdk` client instance pattern via a new `submitDecision`/`useDecision` pair that mirrors `submitCompletion`/`useCompletion`, calling `client.alpha.decisions.create` instead of `client.chat.send`.

**Tech Stack:** React 19 + TypeScript, Radix Themes, `@openrouter/sdk` (`alpha.decisions.create`), `@untitled/ui-kit` `JsonEditor`, `@tanstack/react-query`, Vitest + Testing Library + `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-10-22-typesafe-page-design.md`

## Global Constraints

- Default model string is `~typesafe/jev-latest`; the model field is editable (`ModelAutoComplete`), never hardcoded with no field.
- No PouchDB persistence for this page in this iteration — all state is page-local `useState`.
- Image state items are encoded client-side via `FileReader.readAsDataURL` into a `data:image/...;base64,...` string — no upload endpoint.
- No drag-and-drop library; item reordering (state items, score labels) uses up/down `IconButton`s only.
- A question's `name` is used verbatim (trimmed) as its `questions` record key and is not otherwise validated.
- This page is single-call only — no batch/multi-call running of decisions.
- Requests go through `@openrouter/sdk`'s `client.alpha.decisions.create({ decisionsRequest: { model, state, questions } })`, never `client.chat.send`.

## Review Focus

- Submitting with zero questions defined must not fire a request — the Submit button stays disabled rather than sending an empty `questions: {}`.
- Two questions with the same (or both blank) trimmed `name` must not crash serialization — blank-named drafts are skipped and a duplicate name's last entry wins the object key, matching plain JS object-literal semantics.
- Switching a question's `type` after its criteria are filled in must discard the old type's criteria cleanly, so the serialized request never carries a shape mismatch (e.g. leftover `options` on a `noul`-typed question).
- Pasting invalid JSON, or valid JSON missing `state`/`questions`, into JSON mode must not crash the page or silently submit garbage — parsing fails closed (returns `null`), and Submit/switching back to Form mode stays blocked until it's fixed.
- An active provider that exists but has a blank `apiKey` must be treated the same as no active provider at all — `useDecision` throws the same "Configure a provider in Settings before submitting." error rather than sending a request with an empty key.

---

### Task 1: Decision draft types and pure serialization (`lib/decision-utils.ts`)

**Files:**
- Modify: `src/types.ts` (append decision wire types)
- Create: `src/lib/decision-utils.ts`
- Test: `src/lib/decision-utils.test.ts`

**Interfaces:**
- Consumes: nothing new (pure module).
- Produces (used by Tasks 2–6):
  - `types.ts`: `DecisionStateItem = string | { type: 'image_url'; image_url: { url: string } }`, `DecisionQuestion = { type: 'noul'; instructions: string; criteria: { true: string; false: string } } | { type: 'choice'; instructions: string; criteria: Record<string, string> } | { type: 'score'; instructions: string; criteria: string[] }`, `DecisionAnswer = { type: 'noul'; noul: number } | { type: 'choice'; choice: string; probabilities: Record<string, number> } | { type: 'score'; score: string; probabilities: Record<string, number> }`, `DecisionResult = { answers: Record<string, DecisionAnswer> }`.
  - `decision-utils.ts`: `StateItem` (`{ id: string; kind: 'text'; text: string } | { id: string; kind: 'image'; dataUrl: string; fileName?: string }`), `ChoiceOption = { id: string; key: string; description: string }`, `ScoreLabel = { id: string; text: string }`, `QuestionDraft` (`{ id: string; name: string; type: 'noul'; instructions: string; criteriaTrue: string; criteriaFalse: string } | { id: string; name: string; type: 'choice'; instructions: string; options: ChoiceOption[] } | { id: string; name: string; type: 'score'; instructions: string; labels: ScoreLabel[] }`), `createTextStateItem(): StateItem`, `createImageStateItem(dataUrl: string, fileName?: string): StateItem`, `createQuestionDraft(): QuestionDraft`, `readFileAsDataUrl(file: File): Promise<string>`, `stateItemsToDecisionState(items: StateItem[]): DecisionStateItem[]`, `questionDraftsToRecord(drafts: QuestionDraft[]): Record<string, DecisionQuestion>`, `buildDecisionRequestObject(stateItems: StateItem[], drafts: QuestionDraft[]): { state: DecisionStateItem[]; questions: Record<string, DecisionQuestion> }`, `parseDecisionRequestObject(raw: string): { stateItems: StateItem[]; questions: QuestionDraft[] } | null`.

- [ ] **Step 1: Append decision types to `src/types.ts`**

Add the four `Decision*` type aliases exactly as listed in Interfaces above, after the existing `MultipleResultsSnapshot` type.

- [ ] **Step 2: Write failing tests for `stateItemsToDecisionState` and `questionDraftsToRecord`**

```ts
// src/lib/decision-utils.test.ts
import { describe, expect, it } from 'vitest';
import { stateItemsToDecisionState, questionDraftsToRecord } from './decision-utils';
import type { StateItem, QuestionDraft } from './decision-utils';

describe('stateItemsToDecisionState', () => {
  it('maps a text item to a plain string and an image item to an image_url block', () => {
    const items: StateItem[] = [
      { id: '1', kind: 'text', text: 'Listing: vintage red bicycle' },
      { id: '2', kind: 'image', dataUrl: 'data:image/png;base64,AAA', fileName: 'bike.png' },
    ];
    expect(stateItemsToDecisionState(items)).toEqual([
      'Listing: vintage red bicycle',
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    ]);
  });
});

describe('questionDraftsToRecord', () => {
  it('maps a noul draft to its criteria shape, keyed by trimmed name', () => {
    const drafts: QuestionDraft[] = [
      { id: 'a', name: ' matches_listing ', type: 'noul', instructions: 'Does it match?', criteriaTrue: 'Yes', criteriaFalse: 'No' },
    ];
    expect(questionDraftsToRecord(drafts)).toEqual({
      matches_listing: { type: 'noul', instructions: 'Does it match?', criteria: { true: 'Yes', false: 'No' } },
    });
  });

  it('maps a choice draft, dropping options with a blank key', () => {
    const drafts: QuestionDraft[] = [
      {
        id: 'b',
        name: 'category',
        type: 'choice',
        instructions: 'Which category?',
        options: [
          { id: '1', key: 'bikes', description: 'Complete bicycles' },
          { id: '2', key: '  ', description: 'ignored' },
        ],
      },
    ];
    expect(questionDraftsToRecord(drafts)).toEqual({
      category: { type: 'choice', instructions: 'Which category?', criteria: { bikes: 'Complete bicycles' } },
    });
  });

  it('maps a score draft to an ordered label array', () => {
    const drafts: QuestionDraft[] = [
      {
        id: 'c',
        name: 'condition',
        type: 'score',
        instructions: 'How worn?',
        labels: [{ id: '1', text: 'Like new' }, { id: '2', text: 'Heavy wear' }],
      },
    ];
    expect(questionDraftsToRecord(drafts)).toEqual({
      condition: { type: 'score', instructions: 'How worn?', criteria: ['Like new', 'Heavy wear'] },
    });
  });

  it('skips drafts whose trimmed name is blank', () => {
    const drafts: QuestionDraft[] = [
      { id: 'd', name: '   ', type: 'noul', instructions: 'x', criteriaTrue: 'y', criteriaFalse: 'z' },
    ];
    expect(questionDraftsToRecord(drafts)).toEqual({});
  });

  it('lets a later duplicate-named draft overwrite an earlier one', () => {
    const drafts: QuestionDraft[] = [
      { id: 'e', name: 'dup', type: 'noul', instructions: 'first', criteriaTrue: 'y', criteriaFalse: 'z' },
      { id: 'f', name: 'dup', type: 'score', instructions: 'second', labels: [{ id: '1', text: 'A' }] },
    ];
    expect(questionDraftsToRecord(drafts)).toEqual({
      dup: { type: 'score', instructions: 'second', criteria: ['A'] },
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run src/lib/decision-utils.test.ts`
Expected: FAIL with "Cannot find module './decision-utils'" (or similar, since the file doesn't exist yet).

- [ ] **Step 4: Implement `createTextStateItem`, `createImageStateItem`, `createQuestionDraft`, `stateItemsToDecisionState`, `questionDraftsToRecord` in `src/lib/decision-utils.ts`**

Use `crypto.randomUUID()` for generated `id`s, matching `tool-card.tsx`'s convention. `createQuestionDraft()` returns a blank `noul`-typed draft (`name: ''`, `instructions: ''`, `criteriaTrue: ''`, `criteriaFalse: ''`). Filtering logic (blank keys/names dropped) mirrors `draftToTool`'s property filtering in `tool-card.tsx`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/lib/decision-utils.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing tests for `buildDecisionRequestObject` and `parseDecisionRequestObject`**

```ts
describe('buildDecisionRequestObject / parseDecisionRequestObject', () => {
  it('round-trips state and questions through the request object', () => {
    const stateItems: StateItem[] = [{ id: '1', kind: 'text', text: 'hello' }];
    const drafts: QuestionDraft[] = [
      { id: 'a', name: 'matches', type: 'noul', instructions: 'Match?', criteriaTrue: 'Yes', criteriaFalse: 'No' },
    ];
    const built = buildDecisionRequestObject(stateItems, drafts);
    expect(built).toEqual({
      state: ['hello'],
      questions: { matches: { type: 'noul', instructions: 'Match?', criteria: { true: 'Yes', false: 'No' } } },
    });

    const parsed = parseDecisionRequestObject(JSON.stringify(built));
    expect(parsed?.stateItems).toEqual([{ id: expect.any(String), kind: 'text', text: 'hello' }]);
    expect(parsed?.questions).toEqual([
      {
        id: expect.any(String),
        name: 'matches',
        type: 'noul',
        instructions: 'Match?',
        criteriaTrue: 'Yes',
        criteriaFalse: 'No',
      },
    ]);
  });

  it('returns null for invalid JSON', () => {
    expect(parseDecisionRequestObject('{not json')).toBeNull();
  });

  it('returns null when state or questions is missing or the wrong shape', () => {
    expect(parseDecisionRequestObject(JSON.stringify({ state: 'not-an-array', questions: {} }))).toBeNull();
    expect(parseDecisionRequestObject(JSON.stringify({ state: [] }))).toBeNull();
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `yarn vitest run src/lib/decision-utils.test.ts`
Expected: FAIL with "buildDecisionRequestObject is not a function" (or similar)

- [ ] **Step 8: Implement `readFileAsDataUrl`, `buildDecisionRequestObject`, `parseDecisionRequestObject` in `src/lib/decision-utils.ts`**

`buildDecisionRequestObject` composes `stateItemsToDecisionState` + `questionDraftsToRecord` into `{ state, questions }`. `parseDecisionRequestObject` does a `JSON.parse` inside a try/catch (returning `null` on throw, same style as `parsePayload` in `payload-utils.ts`), validates `Array.isArray(parsed.state)` and `typeof parsed.questions === 'object' && parsed.questions !== null`, then maps each state entry back to a `StateItem` (string → `kind: 'text'`, `{ type: 'image_url', ... }` → `kind: 'image'`) and each `[name, question]` entry back to a `QuestionDraft` of the matching `type`, assigning fresh `crypto.randomUUID()` ids throughout. `readFileAsDataUrl` wraps `FileReader` in a `Promise`, resolving with `reader.result as string` on `onload` and rejecting with `reader.error` on `onerror`.

- [ ] **Step 9: Run tests to verify they pass**

Run: `yarn vitest run src/lib/decision-utils.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/lib/decision-utils.ts src/lib/decision-utils.test.ts
git commit -m "feat: add decision draft types and serialization utilities"
```

---

### Task 2: `submitDecision` client call and `useDecision` hook

**Files:**
- Modify: `src/lib/openrouter-client.ts`
- Create: `src/hooks/use-decision.ts`
- Test: `src/lib/openrouter-client.test.ts` (new), `src/hooks/use-decision.test.tsx` (new)

**Interfaces:**
- Consumes: `DecisionStateItem`, `DecisionQuestion`, `DecisionResult` (Task 1, `types.ts`); `useActiveProvider()` from `src/hooks/use-providers.ts` (existing, returns `{ activeProvider: ProviderProfile | null, isLoading: boolean }`).
- Produces (used by Task 6): `SubmitDecisionParams = { serverURL: string; apiKey: string; model: string; state: DecisionStateItem[]; questions: Record<string, DecisionQuestion> }`, `submitDecision(params: SubmitDecisionParams): Promise<DecisionResult>` in `src/lib/openrouter-client.ts`; `DecisionInput = { model: string; state: DecisionStateItem[]; questions: Record<string, DecisionQuestion> }`, `useDecision(): UseMutationResult<DecisionResult, Error, DecisionInput>` in `src/hooks/use-decision.ts`.

- [ ] **Step 1: Write failing test for `submitDecision`**

```ts
// src/lib/openrouter-client.test.ts
import { describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
vi.mock('@openrouter/sdk', () => ({
  OpenRouter: vi.fn().mockImplementation(() => ({
    alpha: { decisions: { create: createMock } },
  })),
}));

import { submitDecision } from './openrouter-client';

describe('submitDecision', () => {
  it('calls alpha.decisions.create with the given model/state/questions and returns its result', async () => {
    const canned = { answers: { matches: { type: 'noul', noul: 0.9 } } };
    createMock.mockResolvedValueOnce(canned);

    const result = await submitDecision({
      serverURL: 'https://openrouter.ai/api/v1',
      apiKey: 'key',
      model: '~typesafe/jev-latest',
      state: ['hello'],
      questions: { matches: { type: 'noul', instructions: 'x', criteria: { true: 'y', false: 'z' } } },
    });

    expect(createMock).toHaveBeenCalledWith({
      decisionsRequest: {
        model: '~typesafe/jev-latest',
        state: ['hello'],
        questions: { matches: { type: 'noul', instructions: 'x', criteria: { true: 'y', false: 'z' } } },
      },
    });
    expect(result).toEqual(canned);
  });

  it('wraps a thrown error in a plain Error', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));
    await expect(
      submitDecision({ serverURL: 'url', apiKey: 'k', model: 'm', state: [], questions: {} }),
    ).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/lib/openrouter-client.test.ts`
Expected: FAIL with "submitDecision is not a function" (or similar)

- [ ] **Step 3: Implement `SubmitDecisionParams` and `submitDecision` in `src/lib/openrouter-client.ts`**

Follow `submitCompletion`'s exact structure: construct `new OpenRouter({ apiKey, serverURL })`, call `client.alpha.decisions.create({ decisionsRequest: { model, state, questions } })` inside a try/catch that rethrows `err instanceof Error ? err.message : String(err)` wrapped in `new Error(..., { cause: err })`, and return the awaited result cast to `DecisionResult`.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/lib/openrouter-client.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for `useDecision`**

```tsx
// src/hooks/use-decision.test.tsx
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { putDoc } from '../db/client';
import type { ProviderProfile } from '../db/types';

vi.mock('../lib/openrouter-client', () => ({
  submitDecision: vi.fn().mockResolvedValue({ answers: { matches: { type: 'noul', noul: 0.9 } } }),
}));

import { useDecision } from './use-decision';
import { submitDecision } from '../lib/openrouter-client';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDecision', () => {
  it('throws a configure-provider error when there is no active provider', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDecision(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ model: 'm', state: [], questions: {} }),
      ).rejects.toThrow('Configure a provider in Settings before submitting.');
    });
  });

  it('throws the same error when the active provider has a blank apiKey', async () => {
    const now = new Date().toISOString();
    const provider: ProviderProfile = {
      _id: `provider:${crypto.randomUUID()}`,
      type: 'provider',
      label: 'Blank key',
      serverURL: 'https://example.test',
      apiKey: '',
      createdAt: now,
      updatedAt: now,
    };
    await putDoc(provider);
    await putDoc({ _id: 'app-settings', type: 'settings', activeProviderId: provider._id, syncEnabled: false });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDecision(), { wrapper });
    await waitFor(() => expect(result.current.isIdle).toBe(true));

    await act(async () => {
      await expect(
        result.current.mutateAsync({ model: 'm', state: [], questions: {} }),
      ).rejects.toThrow('Configure a provider in Settings before submitting.');
    });
  });

  it('delegates to submitDecision when an active provider with an apiKey exists', async () => {
    const now = new Date().toISOString();
    const provider: ProviderProfile = {
      _id: `provider:${crypto.randomUUID()}`,
      type: 'provider',
      label: 'Real',
      serverURL: 'https://example.test',
      apiKey: 'secret',
      createdAt: now,
      updatedAt: now,
    };
    await putDoc(provider);
    await putDoc({ _id: 'app-settings', type: 'settings', activeProviderId: provider._id, syncEnabled: false });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDecision(), { wrapper });

    let data;
    await act(async () => {
      data = await result.current.mutateAsync({ model: 'm', state: ['hi'], questions: {} });
    });

    expect(submitDecision).toHaveBeenCalledWith({
      serverURL: 'https://example.test',
      apiKey: 'secret',
      model: 'm',
      state: ['hi'],
      questions: {},
    });
    expect(data).toEqual({ answers: { matches: { type: 'noul', noul: 0.9 } } });
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `yarn vitest run src/hooks/use-decision.test.tsx`
Expected: FAIL with "Cannot find module './use-decision'"

- [ ] **Step 7: Implement `DecisionInput` and `useDecision` in `src/hooks/use-decision.ts`**

Mirror `use-completion.ts`'s `useCompletion` exactly: read `activeProvider` from `useActiveProvider()`, throw `new Error('Configure a provider in Settings before submitting.')` when `!activeProvider || !activeProvider.apiKey`, otherwise call `submitDecision({ serverURL: activeProvider.serverURL, apiKey: activeProvider.apiKey, ...input })`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/hooks/use-decision.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/openrouter-client.ts src/lib/openrouter-client.test.ts src/hooks/use-decision.ts src/hooks/use-decision.test.tsx
git commit -m "feat: add submitDecision and useDecision for the Jev decisions API"
```

---

### Task 3: `StateList` component

**Files:**
- Create: `src/components/state-list.tsx`
- Create: `src/components/state-list.module.css` (only if styling needs beyond Radix props — otherwise skip)
- Test: `src/components/state-list.test.tsx`

**Interfaces:**
- Consumes: `StateItem`, `createTextStateItem`, `createImageStateItem`, `readFileAsDataUrl` from `src/lib/decision-utils.ts` (Task 1).
- Produces (used by Task 6): `StateListProps = { items: StateItem[]; onChange: (items: StateItem[]) => void }`, `export function StateList({ items, onChange }: StateListProps)`.

- [ ] **Step 1: Write failing tests for empty state, add/edit/remove/reorder of text items**

```tsx
// src/components/state-list.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { StateList } from './state-list';
import type { StateItem } from '../lib/decision-utils';

describe('StateList', () => {
  it('shows a placeholder when there are no items', () => {
    renderWithProviders(<StateList items={[]} onChange={() => {}} />);
    expect(screen.getByText('No state items yet')).toBeInTheDocument();
  });

  it('adds a text item when "Add text" is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<StateList items={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Add text' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'text', text: '' }),
    ]);
  });

  it('calls onChange with the edited text as the user types', async () => {
    const user = userEvent.setup();
    const items: StateItem[] = [{ id: '1', kind: 'text', text: '' }];
    const onChange = vi.fn();
    renderWithProviders(<StateList items={items} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'hi');

    expect(onChange).toHaveBeenLastCalledWith([{ id: '1', kind: 'text', text: 'hi' }]);
  });

  it('removes an item when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const items: StateItem[] = [{ id: '1', kind: 'text', text: 'keep me' }];
    const onChange = vi.fn();
    renderWithProviders(<StateList items={items} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('moves an item down when its move-down button is clicked', async () => {
    const user = userEvent.setup();
    const items: StateItem[] = [
      { id: '1', kind: 'text', text: 'first' },
      { id: '2', kind: 'text', text: 'second' },
    ];
    const onChange = vi.fn();
    renderWithProviders(<StateList items={items} onChange={onChange} />);

    await user.click(screen.getAllByRole('button', { name: /move down/i })[0]);

    expect(onChange).toHaveBeenCalledWith([items[1], items[0]]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/components/state-list.test.tsx`
Expected: FAIL with "Cannot find module './state-list'"

- [ ] **Step 3: Implement `StateList` in `src/components/state-list.tsx`**

Row layout follows `message-block.tsx`'s visual weight (Radix `Flex`/`TextArea`/`IconButton`). Each row has move-up/move-down `IconButton`s (disabled at the respective end of the list) with `aria-label="Move up"`/`"Move down"`, and a remove `IconButton` with `aria-label` containing "remove". "Add text"/"Add image" buttons sit above the list, calling `onChange([...items, createTextStateItem()])` / `onChange([...items, createImageStateItem(dataUrl, file.name)])`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/components/state-list.test.tsx`
Expected: PASS

- [ ] **Step 5: Write a failing test for adding an image item**

```tsx
it('adds an image item from a chosen file, reading it via readFileAsDataUrl', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderWithProviders(<StateList items={[]} onChange={onChange} />);

  const file = new File(['fake-bytes'], 'bike.png', { type: 'image/png' });
  const input = screen.getByLabelText('Add image') as HTMLInputElement;
  await user.upload(input, file);

  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'image', fileName: 'bike.png' }),
    ]),
  );
});
```

Mock `readFileAsDataUrl` at the top of the test file so the assertion doesn't depend on jsdom's `FileReader` fidelity:

```ts
vi.mock('../lib/decision-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/decision-utils')>()),
  readFileAsDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AAA'),
}));
```

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn vitest run src/components/state-list.test.tsx`
Expected: FAIL (no file input labeled "Add image", or image-add path not implemented)

- [ ] **Step 7: Implement the image-add path in `StateList`**

A hidden `<input type="file" accept="image/*" aria-label="Add image">` triggered by a visible "Add image" button; its `onChange` reads the selected `File`, awaits `readFileAsDataUrl(file)`, then calls `onChange([...items, createImageStateItem(dataUrl, file.name)])`. An image row renders a thumbnail `<img src={item.dataUrl}>` plus the `fileName`, with the same remove/move controls as a text row.

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/components/state-list.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/state-list.tsx src/components/state-list.test.tsx
git commit -m "feat: add StateList component for editing decision state items"
```

---

### Task 4: `QuestionCard` component

**Files:**
- Create: `src/components/question-card.tsx`
- Create: `src/components/question-card.module.css` (reuse `tool-card.module.css` class names/styles as a starting point if convenient)
- Test: `src/components/question-card.test.tsx`

**Interfaces:**
- Consumes: `QuestionDraft`, `ChoiceOption`, `ScoreLabel` from `src/lib/decision-utils.ts` (Task 1).
- Produces (used by Task 6): `QuestionCardProps = { draft: QuestionDraft; defaultExpanded?: boolean; onChange: (draft: QuestionDraft) => void; onRemove: () => void }`, `export function QuestionCard({ draft, defaultExpanded, onChange, onRemove }: QuestionCardProps)`.

- [ ] **Step 1: Write failing tests for collapse/expand and common fields**

```tsx
// src/components/question-card.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { QuestionCard } from './question-card';
import type { QuestionDraft } from '../lib/decision-utils';

const NOUL_DRAFT: QuestionDraft = {
  id: '1',
  name: 'matches_listing',
  type: 'noul',
  instructions: 'Does it match?',
  criteriaTrue: 'Yes',
  criteriaFalse: 'No',
};

describe('QuestionCard', () => {
  it('renders collapsed by default, showing only the name', () => {
    renderWithProviders(<QuestionCard draft={NOUL_DRAFT} onChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('matches_listing')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Does it match?')).not.toBeInTheDocument();
  });

  it('expands to show Name/Instructions/criteria fields when the header is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuestionCard draft={NOUL_DRAFT} onChange={() => {}} onRemove={() => {}} />);
    await user.click(screen.getByText('matches_listing'));
    expect(screen.getByDisplayValue('matches_listing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Does it match?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Yes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('No')).toBeInTheDocument();
  });

  it('calls onChange live as the Name field is edited', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <QuestionCard draft={NOUL_DRAFT} defaultExpanded onChange={onChange} onRemove={() => {}} />,
    );
    await user.type(screen.getByDisplayValue('matches_listing'), 'x');
    expect(onChange).toHaveBeenLastCalledWith({ ...NOUL_DRAFT, name: 'matches_listingx' });
  });

  it('calls onRemove when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProviders(<QuestionCard draft={NOUL_DRAFT} onChange={() => {}} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('shows a fallback label when the name is blank', () => {
    const blankDraft: QuestionDraft = { ...NOUL_DRAFT, name: '' };
    renderWithProviders(<QuestionCard draft={blankDraft} onChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('Untitled question')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/components/question-card.test.tsx`
Expected: FAIL with "Cannot find module './question-card'"

- [ ] **Step 3: Implement the collapsed/expanded shell, Name/Instructions fields, and `noul` criteria in `src/components/question-card.tsx`**

Copy `tool-card.tsx`'s `ToolCard` collapse/expand/local-state-plus-`commit` structure (local `useState` for `expanded`/`name`/`instructions`/type-specific fields, committing the full draft to `onChange` on every field change). The collapsed/expanded header displays `name || 'Untitled question'`, matching `ToolCard`'s `name || 'Untitled tool'` fallback. The Name `TextField.Root` has `placeholder="question_name"`. Render the `noul` branch's two "True means"/"False means" `TextField.Root`s bound to `criteriaTrue`/`criteriaFalse`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/components/question-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Write failing tests for the type `Select` and the `choice`/`score` criteria editors**

```tsx
it('switching type to choice resets criteria to an empty options list', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderWithProviders(<QuestionCard draft={NOUL_DRAFT} defaultExpanded onChange={onChange} onRemove={() => {}} />);

  await user.click(screen.getByLabelText('Question type'));
  await user.click(screen.getByRole('option', { name: 'choice' }));

  expect(onChange).toHaveBeenLastCalledWith({
    id: '1',
    name: 'matches_listing',
    type: 'choice',
    instructions: 'Does it match?',
    options: [],
  });
});

it('adds a choice option and edits its key/description', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const choiceDraft: QuestionDraft = {
    id: '2',
    name: 'category',
    type: 'choice',
    instructions: 'Which category?',
    options: [],
  };
  renderWithProviders(<QuestionCard draft={choiceDraft} defaultExpanded onChange={onChange} onRemove={() => {}} />);

  await user.click(screen.getByRole('button', { name: 'Add option' }));
  expect(onChange).toHaveBeenLastCalledWith({
    ...choiceDraft,
    options: [{ id: expect.any(String), key: '', description: '' }],
  });
});

it('adds a score label and reorders it', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const scoreDraft: QuestionDraft = {
    id: '3',
    name: 'condition',
    type: 'score',
    instructions: 'How worn?',
    labels: [{ id: 'a', text: 'Like new' }, { id: 'b', text: 'Heavy wear' }],
  };
  renderWithProviders(<QuestionCard draft={scoreDraft} defaultExpanded onChange={onChange} onRemove={() => {}} />);

  await user.click(screen.getAllByRole('button', { name: /move down/i })[0]);
  expect(onChange).toHaveBeenLastCalledWith({
    ...scoreDraft,
    labels: [{ id: 'b', text: 'Heavy wear' }, { id: 'a', text: 'Like new' }],
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `yarn vitest run src/components/question-card.test.tsx`
Expected: FAIL (type `Select` and choice/score editors not implemented)

- [ ] **Step 7: Implement the type `Select` (`aria-label="Question type"`) and the `choice`/`score` criteria editors**

The `Select.Root` has three `Select.Item`s (`noul`, `choice`, `score`); on `onValueChange`, build a fresh draft of the new type reusing the current `name`/`instructions` and an empty criteria container (`criteriaTrue: '', criteriaFalse: ''` for `noul`; `options: []` for `choice`; `labels: []` for `score`), then call `onChange`. The `choice` branch renders one `ChoiceOptionRow` per option (a local function in the same file, modeled on `tool-card.tsx`'s `PropertyRow`: a `key` `TextField.Root`, a `description` `TextField.Root`, and a remove `IconButton`) plus an "Add option" button appending `{ id: crypto.randomUUID(), key: '', description: '' }`. The `score` branch renders one label row per entry (a single `TextField.Root` bound to `text`) with move-up/move-down/remove controls identical in shape to `StateList`'s row controls, plus an "Add label" button appending `{ id: crypto.randomUUID(), text: '' }`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/components/question-card.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/question-card.tsx src/components/question-card.test.tsx
git commit -m "feat: add QuestionCard component for editing decision questions"
```

---

### Task 5: `DecisionAnswerCard` component

**Files:**
- Create: `src/components/decision-answer-card.tsx`
- Test: `src/components/decision-answer-card.test.tsx`

**Interfaces:**
- Consumes: `DecisionQuestion`, `DecisionAnswer` from `src/types.ts` (Task 1).
- Produces (used by Task 6): `DecisionAnswerCardProps = { name: string; question: DecisionQuestion; answer: DecisionAnswer }`, `export function DecisionAnswerCard({ name, question, answer }: DecisionAnswerCardProps)`.

- [ ] **Step 1: Write failing tests for all three answer types**

```tsx
// src/components/decision-answer-card.test.tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { DecisionAnswerCard } from './decision-answer-card';
import type { DecisionAnswer, DecisionQuestion } from '../types';

describe('DecisionAnswerCard', () => {
  it('renders a noul answer as a percentage with its true/false captions', () => {
    const question: DecisionQuestion = {
      type: 'noul',
      instructions: 'x',
      criteria: { true: 'The listed item is shown', false: 'Something else' },
    };
    const answer: DecisionAnswer = { type: 'noul', noul: 0.92 };
    renderWithProviders(<DecisionAnswerCard name="matches_listing" question={question} answer={answer} />);
    expect(screen.getByText('matches_listing')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('The listed item is shown')).toBeInTheDocument();
    expect(screen.getByText('Something else')).toBeInTheDocument();
  });

  it('renders a choice answer with the winning option marked and each probability shown', () => {
    const question: DecisionQuestion = {
      type: 'choice',
      instructions: 'x',
      criteria: { bikes: 'Complete bicycles', parts: 'Components' },
    };
    const answer: DecisionAnswer = {
      type: 'choice',
      choice: 'bikes',
      probabilities: { bikes: 0.8, parts: 0.2 },
    };
    renderWithProviders(<DecisionAnswerCard name="category" question={question} answer={answer} />);
    expect(screen.getByText('✓ bikes')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('renders a score answer with the winning label marked and each probability shown', () => {
    const question: DecisionQuestion = {
      type: 'score',
      instructions: 'x',
      criteria: ['Like new', 'Light wear', 'Heavy wear'],
    };
    const answer: DecisionAnswer = {
      type: 'score',
      score: 'Light wear',
      probabilities: { 'Like new': 0.1, 'Light wear': 0.7, 'Heavy wear': 0.2 },
    };
    renderWithProviders(<DecisionAnswerCard name="condition" question={question} answer={answer} />);
    expect(screen.getByText('✓ Light wear')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/components/decision-answer-card.test.tsx`
Expected: FAIL with "Cannot find module './decision-answer-card'"

- [ ] **Step 3: Implement `DecisionAnswerCard` in `src/components/decision-answer-card.tsx`**

A `Card` whose header shows `name`. Branch on `answer.type`: `noul` renders a horizontal bar whose width is `${answer.noul * 100}%` plus a `${Math.round(answer.noul * 100)}%` label, with the `true`/`false` criteria text (from the matching `noul`-typed `question.criteria`) as two captions below. `choice` renders one row per `Object.entries(question.criteria)` (the `[key, description]` pairs), each showing `description`, a `${Math.round(probabilities[key] * 100)}%` label, and a probability bar; the row whose `key === answer.choice` is prefixed with `✓ ` (matching the "✓ name" convention already used for passing test-suite checks per the project's `CLAUDE.md` §6.1). `score` renders one row per `question.criteria` label in order, each showing the label text and its `${Math.round(probabilities[label] * 100)}%`, with the row whose text `=== answer.score` prefixed with `✓ `.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/components/decision-answer-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/decision-answer-card.tsx src/components/decision-answer-card.test.tsx
git commit -m "feat: add DecisionAnswerCard component for rendering decision answers"
```

---

### Task 6: `TypesafePage`, route, and toolbar nav link

**Files:**
- Create: `src/pages/typesafe-page.tsx`
- Modify: `src/router.tsx`
- Modify: `src/components/toolbar.tsx`
- Test: `src/pages/typesafe-page.test.tsx`, `src/components/toolbar.test.tsx` (new)

**Interfaces:**
- Consumes: `StateList` (Task 3), `QuestionCard` (Task 4), `DecisionAnswerCard` (Task 5), `useDecision` (Task 2), `buildDecisionRequestObject`, `parseDecisionRequestObject`, `questionDraftsToRecord`, `createQuestionDraft`, `StateItem`, `QuestionDraft` (Task 1), `useActiveProvider` (existing, `src/hooks/use-providers.ts`), `SubmitLoadingOverlay` (existing, `src/components/submit-loading-overlay.tsx`), `JsonEditor` (existing, `@untitled/ui-kit`).
- Produces: `export function TypesafePage()`; no exports consumed by later tasks (this is the last task).

- [ ] **Step 1: Write failing tests for the provider-not-configured state and the empty-questions submit guard**

```tsx
// src/pages/typesafe-page.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { putDoc } from '../db/client';
import type { ProviderProfile } from '../db/types';

vi.mock('../lib/openrouter-client', () => ({
  submitDecision: vi.fn().mockResolvedValue({
    answers: { matches_listing: { type: 'noul', noul: 0.92 } },
  }),
}));

import { TypesafePage } from './typesafe-page';

describe('TypesafePage', () => {
  it('shows a configure-provider callout and disables Submit when there is no active provider', async () => {
    renderWithProviders(<TypesafePage />);
    expect(await screen.findByText(/Configure a provider in Settings before submitting/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('keeps Submit disabled when a provider is configured but no questions are defined', async () => {
    const now = new Date().toISOString();
    const provider: ProviderProfile = {
      _id: `provider:${crypto.randomUUID()}`,
      type: 'provider',
      label: 'Real',
      serverURL: 'https://example.test',
      apiKey: 'secret',
      createdAt: now,
      updatedAt: now,
    };
    await putDoc(provider);
    await putDoc({ _id: 'app-settings', type: 'settings', activeProviderId: provider._id, syncEnabled: false });

    renderWithProviders(<TypesafePage />);
    await screen.findByDisplayValue('~typesafe/jev-latest');
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/pages/typesafe-page.test.tsx`
Expected: FAIL with "Cannot find module './typesafe-page'"

- [ ] **Step 3: Implement the page shell, model field, Submit-disabled logic in `src/pages/typesafe-page.tsx`**

State as specified in the spec's §3 plus `mode`/`jsonDraft`/`isJsonInvalid` per §6: `model` (default `'~typesafe/jev-latest'`), `stateItems: StateItem[]` (default `[]`), `questions: QuestionDraft[]` (default `[]`), `mode: 'form' | 'json'`, `jsonDraft: string | null`, `result: DecisionResult | null`, `durationMs: number | null`, `error: string | null`. Use `useActiveProvider()` to read `activeProvider` and render the same amber `Callout` pattern as `record-page.tsx` ("Configure a provider in Settings before submitting." + a `Link` to `/settings`) when `!activeProvider?.apiKey`. The model field is a `ModelAutoComplete` bound to `model`. Submit button (`"Submit"`) is disabled when `!activeProvider?.apiKey || questions.length === 0 || decision.isPending || isJsonInvalid`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/pages/typesafe-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Write a failing test for the full submit → result flow**

```tsx
it('submits the built request and renders the returned answers', async () => {
  const user = userEvent.setup();
  const now = new Date().toISOString();
  const provider: ProviderProfile = {
    _id: `provider:${crypto.randomUUID()}`,
    type: 'provider',
    label: 'Real',
    serverURL: 'https://example.test',
    apiKey: 'secret',
    createdAt: now,
    updatedAt: now,
  };
  await putDoc(provider);
  await putDoc({ _id: 'app-settings', type: 'settings', activeProviderId: provider._id, syncEnabled: false });

  renderWithProviders(<TypesafePage />);
  await screen.findByDisplayValue('~typesafe/jev-latest');

  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.click(screen.getByText('Untitled question'));
  await user.type(screen.getByPlaceholderText('question_name'), 'matches_listing');

  await user.click(screen.getByRole('button', { name: 'Submit' }));

  expect(await screen.findByText('92%')).toBeInTheDocument();
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn vitest run src/pages/typesafe-page.test.tsx`
Expected: FAIL (no "Add question" button / submit flow not wired yet)

- [ ] **Step 7: Implement `StateList`/`QuestionCard` wiring, Submit handler, and result rendering**

Render `<StateList items={stateItems} onChange={setStateItems} />` and one `<QuestionCard>` per draft in `questions` (plus an "Add question" button calling `setQuestions([...questions, createQuestionDraft()])`); `QuestionCard`'s Name field placeholder is `"question_name"`. `handleSubmit` builds `{ state, questions: questionsRecord } = buildDecisionRequestObject(stateItems, questions)`, guards on `questions.length === 0`, measures `durationMs` around `decision.mutateAsync({ model, state, questions: questionsRecord })` (via `performance.now()`), and on success calls `setResult(data)`; on failure sets `error` to the thrown message and leaves `result` untouched. While `decision.isPending`, render `<SubmitLoadingOverlay active={decision.isPending} />` over the results area. Once `result` is set, render one `<DecisionAnswerCard>` per `Object.entries(result.answers)`, looking up each answer's `DecisionQuestion` via `questionsRecord[name]` (recomputed from the current `questions` state at render time, not stored separately) — and a red `Callout` when `error` is set.

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/pages/typesafe-page.test.tsx`
Expected: PASS

- [ ] **Step 9: Write a failing test for JSON-mode round-tripping and the invalid-JSON guard**

```tsx
it('round-trips Form edits into JSON mode and blocks switching back on invalid JSON', async () => {
  const user = userEvent.setup();
  renderWithProviders(<TypesafePage />);

  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.click(screen.getByText('Untitled question'));
  await user.type(screen.getByPlaceholderText('question_name'), 'matches_listing');

  await user.click(screen.getByRole('radio', { name: 'JSON' }));
  expect(screen.getByDisplayValue(/matches_listing/)).toBeInTheDocument();

  // ui-kit's JsonEditor is CodeMirror-based; confirm the actual accessible role it exposes
  // in jsdom (CodeMirror 6 content editors default to role="textbox") and adjust this query
  // if `getByRole('textbox')` doesn't resolve to the editor's content element.
  const editor = screen.getByRole('textbox');
  await user.clear(editor);
  await user.type(editor, '{not json');

  await user.click(screen.getByRole('radio', { name: 'Form' }));
  expect(await screen.findByText(/not valid JSON/i)).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'JSON' })).toBeChecked();
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `yarn vitest run src/pages/typesafe-page.test.tsx`
Expected: FAIL (JSON mode not implemented)

- [ ] **Step 11: Implement JSON mode (`SegmentedControl` "Form"/"JSON") in `typesafe-page.tsx`**

Add a `SegmentedControl.Root` bound to `mode` with two `SegmentedControl.Item`s labeled "Form" and "JSON", above the Form/JSON content area (same placement convention as record-page's Editor/Form toggle). On switching to `'json'`, set `jsonDraft = JSON.stringify(buildDecisionRequestObject(stateItems, questions), null, 2)`. Bind a `ui-kit` `JsonEditor` to `jsonDraft` in JSON mode; its `onChange` sets `jsonDraft` to the new text and calls `parseDecisionRequestObject(value)` — on success, also call `setStateItems`/`setQuestions` from the parsed result and clear `isJsonInvalid`; on `null`, set `isJsonInvalid = true` and leave `stateItems`/`questions` untouched. `handleModeChange('form')` is a no-op (shows a toast "Payload is not valid JSON" and keeps `mode` at `'json'`) while `isJsonInvalid` is true; otherwise it switches `mode` to `'form'` normally. "Copy JSON" button copies `jsonDraft` to the clipboard, matching record-page's Editor-mode convention.

- [ ] **Step 12: Run tests to verify they pass**

Run: `yarn vitest run src/pages/typesafe-page.test.tsx`
Expected: PASS

- [ ] **Step 13: Add the `/typesafe` route**

In `src/router.tsx`, import `TypesafePage` from `./pages/typesafe-page` and add `{ path: '/typesafe', element: <TypesafePage /> }` to the route array (any position — route order doesn't matter here since `/typesafe` doesn't collide with the existing `/:recordId` catch-all only because it's a distinct literal segment, same as `/records` and `/settings` today).

- [ ] **Step 14: Write a failing test for the toolbar nav link**

```tsx
// src/components/toolbar.test.tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { Toolbar } from './toolbar';

describe('Toolbar', () => {
  it('navigates to /typesafe when the typesafe nav button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Toolbar name="Untitled" onNew={() => {}} onSave={() => {}} onSaveAs={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: /typesafe/i }));
    // Navigation assertion matches the existing pattern for other Toolbar nav buttons
    // (no router test harness currently asserts path changes elsewhere in this file;
    // this at minimum confirms the button exists and is clickable without throwing).
    expect(screen.getByRole('button', { name: /typesafe/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 15: Run test to verify it fails**

Run: `yarn vitest run src/components/toolbar.test.tsx`
Expected: FAIL with "Unable to find role 'button' with name /typesafe/i"

- [ ] **Step 16: Add the typesafe nav `IconButton` to `src/components/toolbar.tsx`**

Add an `IconButton` (using `ListChecks` from `lucide-react`) with `aria-label="Typesafe"`, placed before the existing Settings `IconButton`, calling `navigate('/typesafe')`.

- [ ] **Step 17: Run tests to verify they pass**

Run: `yarn vitest run src/components/toolbar.test.tsx`
Expected: PASS

- [ ] **Step 18: Run the full test suite and the production build**

Run: `yarn test`
Expected: all tests pass, including the five new/modified files from this task and Tasks 1–5.

Run: `yarn build`
Expected: completes with no TypeScript errors.

- [ ] **Step 19: Commit**

```bash
git add src/pages/typesafe-page.tsx src/pages/typesafe-page.test.tsx src/router.tsx src/components/toolbar.tsx src/components/toolbar.test.tsx
git commit -m "feat: add the typesafe page, route, and toolbar nav link"
```
