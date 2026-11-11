# `typesafe` page — design spec

Date: 2026-10-22

## 1. Purpose

Add a second top-level page, `/typesafe`, for testing TypeSafe's Jev decision model
(`~typesafe/jev-latest` on OpenRouter) against this app's existing provider-profile
infrastructure. Unlike every other page in this app, Jev is not a chat-completion model:
it takes a `state` (ordered text/image context) plus a set of typed `questions`
(`noul` = yes/no probability, `choice` = pick-one with a probability distribution,
`score` = ordinal scale with a probability distribution) and returns one answer per
question. The request/response travels through the same `@openrouter/sdk` instance as
the rest of the app, via its `alpha.decisions.create` method rather than `chat.send`.

Reference request (from TypeSafe's own SDK example):

```ts
const decision = await openrouter.alpha.decisions.create({
  decisionsRequest: {
    model: '~typesafe/jev-latest',
    state: [
      'Listing: vintage red bicycle, light scratches on the frame',
      { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
    ],
    questions: {
      matches_listing: {
        type: 'noul',
        instructions: 'Does the attached media show the listed item?',
        criteria: { true: 'The listed item is shown', false: 'Something else or nothing is shown' },
      },
      category: {
        type: 'choice',
        instructions: 'Which category fits this listing?',
        criteria: { bikes: 'Complete bicycles', parts: 'Components and accessories', apparel: 'Clothing and gear' },
      },
      condition: {
        type: 'score',
        instructions: 'How worn is the item?',
        criteria: ['Like new', 'Light wear', 'Heavy wear'],
      },
    },
  },
});
// decision.answers.matches_listing -> { type: 'noul', noul: 0.92 }
// decision.answers.category        -> { type: 'choice', choice: 'bikes', probabilities: {...} }
// decision.answers.condition       -> { type: 'score', score: 'Light wear', probabilities: {...} }
```

## 2. Scope decisions (confirmed with user)

- **No persistence for now.** This page is a one-off scratchpad: build a request, submit,
  see the answers. No PouchDB record type, no save/load/history. (Flagged as likely future
  work — if added later, it should follow the existing `AgentRecord`-style pattern:
  `_id: decision:<uuid>`, listed alongside or near `/records`.)
- **State supports text and images from v1.** Image items are read client-side via
  `FileReader.readAsDataURL` into a `data:image/...;base64,...` string — no upload endpoint,
  consistent with "no backend server."
- **Model field is editable**, via the existing `ModelAutoComplete` component, defaulting to
  `~typesafe/jev-latest` but accepting any string (same autocomplete/persistence behavior as
  everywhere else the model field appears).
- **Navigation**: a new icon button in `Toolbar` (next to the Settings gear) links to
  `/typesafe`. The typesafe page does not use `Toolbar` itself (it has no record name/save
  concept) — it gets its own minimal header.

## 3. Route and page-local state

Add to `router.tsx`:
```tsx
{ path: '/typesafe', element: <TypesafePage /> },
```
New file `pages/typesafe-page.tsx`. All state is local (`useState`), nothing persisted:

```ts
type StateItem =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'image'; dataUrl: string; fileName?: string };

type QuestionDraft =
  | { id: string; name: string; type: 'noul'; instructions: string; criteriaTrue: string; criteriaFalse: string }
  | { id: string; name: string; type: 'choice'; instructions: string; options: { id: string; key: string; description: string }[] }
  | { id: string; name: string; type: 'score'; instructions: string; labels: { id: string; text: string }[] };
```

Page state: `model`, `stateItems: StateItem[]`, `questions: QuestionDraft[]`,
`mode: 'form' | 'json'`, `result: DecisionResult | null`, `durationMs`, `error: string | null`,
`isSubmitting`.

The `id` fields on drafts exist only for React keys/reordering/editing and are stripped when
serializing to the real request shape:
- `stateItems` → `DecisionStateItem[]`: text items become plain strings, image items become
  `{ type: 'image_url', image_url: { url: dataUrl } }`.
- `questions` (array of drafts) → `Record<name, DecisionQuestion>`, keyed by each draft's
  trimmed `name`.

JSON mode is a derived view over this same state (see §6) — there is no separately
maintained JSON string to desync.

## 4. State editor (Form mode)

Component `StateList` (new file `components/state-list.tsx`), one row per `StateItem`:

- **Text row**: `TextArea` bound to `text`; remove `IconButton`. Visual weight matches
  `MessageBlock`.
- **Image row**: before a file is chosen, a "Choose image" button (`<input type="file"
  accept="image/*">` triggered via a hidden input + button, same pattern Radix apps use).
  After choosing, shows a thumbnail (`<img>` from `dataUrl`, capped height) and the file name.
  Remove `IconButton` same as text rows.
- Two "Add" buttons above the list: "Add text" / "Add image".
- Reordering via up/down `IconButton`s per row (no drag-and-drop library — order matters
  semantically but reordering is infrequent enough not to need polish).
- Empty state: muted "No state items yet" placeholder (tone matches `FormEditor`'s empty-tools
  text).

## 5. Questions editor (Form mode)

Component `QuestionCard` (new file `components/question-card.tsx`), modeled directly on
`ToolCard`'s collapsible-card pattern (`src/components/tool-card.tsx`):

- Header: `name` (or "Untitled question" placeholder) + type badge + collapse chevron + remove
  `IconButton`. "Add question" appends a blank, auto-expanded `noul` draft.
- Expanded body, common to all types: `Name` text field (used as the `questions` record key;
  not validated beyond trimming, same looseness as `ToolCard`'s tool name) and `Instructions`
  text field.
- Type `Select` (`noul` / `choice` / `score`) switches the criteria editor below it. Switching
  type **discards** the previous type's criteria — no conversion between shapes, since none is
  sensible.
- **`noul` criteria**: two fixed text fields, "True means" / "False means" →
  `criteria: { true, false }`.
- **`choice` criteria**: dynamic add/remove list of `(key, description)` rows, named
  `ChoiceOptionRow` — reuses `tool-card.tsx`'s `PropertyRow` add/remove/edit shape almost
  verbatim → `criteria: Record<key, description>`.
- **`score` criteria**: dynamic, order-sensitive list of plain label strings, add/remove/reorder
  via up/down `IconButton`s (same mechanism as the state list) → `criteria: string[]`
  (low → high).

## 6. JSON mode

Same convention as `record-page.tsx`'s Editor/Form toggle: a `SegmentedControl` switches
between Form (§4–5) and JSON. JSON mode shows a `ui-kit` `JsonEditor` bound to a derived
`{ state, questions }` object — the same serialization used at submit time (§7) — with "Copy
JSON" above it. Editing the JSON directly reparses back into `stateItems`/`questions` drafts
(assigning fresh `id`s on parse). Because JSON mode is always derived from the same underlying
data model rather than tracked separately, switching modes never loses data.

Invalid JSON in JSON mode shows a toast ("Payload is not valid JSON"), same as record-page's
existing behavior, and blocks Submit/mode-switch-back until fixed.

## 7. Submit, lib/types plumbing

`types.ts` additions:
```ts
type DecisionStateItem = string | { type: 'image_url'; image_url: { url: string } };
type DecisionQuestion =
  | { type: 'noul'; instructions: string; criteria: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };
type DecisionAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number> }
  | { type: 'score'; score: string; probabilities: Record<string, number> };
type DecisionResult = { answers: Record<string, DecisionAnswer> };
```

`lib/openrouter-client.ts` additions:
```ts
export type SubmitDecisionParams = {
  serverURL: string;
  apiKey: string;
  model: string;
  state: DecisionStateItem[];
  questions: Record<string, DecisionQuestion>;
};

export async function submitDecision(params: SubmitDecisionParams): Promise<DecisionResult> {
  const client = new OpenRouter({ apiKey: params.apiKey, serverURL: params.serverURL });
  try {
    const result = await client.alpha.decisions.create({
      decisionsRequest: { model: params.model, state: params.state, questions: params.questions },
    });
    return result as DecisionResult;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err), { cause: err });
  }
}
```

New hook `hooks/use-decision.ts`, `useDecision()`, mirroring `use-completion.ts`'s
`useCompletion()`: resolves the active provider via `useActiveProvider()`, throws "Configure a
provider in Settings before submitting." if none/no API key, otherwise delegates to
`submitDecision`, wrapped as a `useMutation`.

Submit button is disabled when: no active provider configured (same amber `Callout` as
record-page), zero questions defined, or a submission is already in flight. Duration is
measured client-side around the call, same as the single-call editor. The existing
`SubmitLoadingOverlay` component is reused for the pending state.

## 8. Result rendering

One card per question, in definition order:
- `noul` → a probability bar (0–100%, labeled with the `noul` value) with the `true`/`false`
  criteria text shown as captions under the bar.
- `choice` → the winning `choice` key highlighted, with one small horizontal bar per option
  drawn from `probabilities`.
- `score` → the winning `score` label highlighted among the ordered labels, with the same
  per-label probability bars.

A `SegmentedControl` toggle (same convention as `ResultPanel`) switches between this
human-readable view and a read-only raw-JSON view of `decision.answers` (via `ui-kit`'s
`JsonEditor`, read-only mode).

Errors thrown from `submitDecision`/`useDecision` render as a red `Callout`, consistent with
error handling elsewhere in the app.

## 9. Explicitly out of scope (this iteration)

- Persistence of typesafe requests/results (PouchDB record type, save/load, history) — noted
  as likely future work in §2.
- Drag-and-drop reordering for state items or score labels (up/down buttons only).
- Validation of question `name` as a valid object key beyond trimming.
- Batch/multi-call running of decisions (this is single-call only, unlike the record page's
  batch tab).

## 10. Files touched / added

- `src/router.tsx` — add `/typesafe` route.
- `src/pages/typesafe-page.tsx` — new.
- `src/components/toolbar.tsx` — add nav icon button to `/typesafe`.
- `src/components/state-list.tsx` — new.
- `src/components/question-card.tsx` — new (includes `ChoiceOptionRow`).
- `src/types.ts` — add `DecisionStateItem`, `DecisionQuestion`, `DecisionAnswer`,
  `DecisionResult`.
- `src/lib/openrouter-client.ts` — add `SubmitDecisionParams`, `submitDecision`.
- `src/hooks/use-decision.ts` — new, `useDecision()`.
- Colocated `*.test.ts(x)` files for each new module, per this project's existing testing
  convention (§ "Testing" in `CLAUDE.md`).
