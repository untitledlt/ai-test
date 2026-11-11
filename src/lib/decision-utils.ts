import type { DecisionAnswer, DecisionQuestion, DecisionStateItem } from '../types';
import { randomUUID } from './uuid';

type DecisionRequestObject = { state: DecisionStateItem[]; questions: Record<string, DecisionQuestion> };

export const DEFAULT_DECISION_MODEL = '~typesafe/jev-latest';

export type DecisionTask = { id: string; model: string; excluded?: boolean };

export function createDecisionTask(): DecisionTask {
  return { id: randomUUID(), model: DEFAULT_DECISION_MODEL, excluded: false };
}

export function formatDecisionAnswer(name: string, answer: DecisionAnswer): string {
  if (answer.type === 'noul') return `${name}: ${Math.round(answer.noul * 100)}%`;
  if (answer.type === 'choice') {
    return `${name}: ${answer.choice} (${Math.round((answer.probabilities[answer.choice] ?? 0) * 100)}%)`;
  }
  return `${name}: ${answer.score} (${Math.round((answer.probabilities[answer.score] ?? 0) * 100)}%)`;
}

export type StateItem =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'image'; dataUrl: string; fileName?: string };

export type ChoiceOption = { id: string; key: string; description: string };
export type ScoreLabel = { id: string; text: string };

export type QuestionDraft =
  | { id: string; name: string; type: 'noul'; instructions: string; criteriaTrue: string; criteriaFalse: string }
  | { id: string; name: string; type: 'choice'; instructions: string; options: ChoiceOption[] }
  | { id: string; name: string; type: 'score'; instructions: string; labels: ScoreLabel[] };

export function createTextStateItem(): StateItem {
  return { id: randomUUID(), kind: 'text', text: '' };
}

export function createImageStateItem(dataUrl: string, fileName?: string): StateItem {
  return { id: randomUUID(), kind: 'image', dataUrl, fileName };
}

export function createQuestionDraft(): QuestionDraft {
  return { id: randomUUID(), name: '', type: 'noul', instructions: '', criteriaTrue: '', criteriaFalse: '' };
}

export function stateItemsToDecisionState(items: StateItem[]): DecisionStateItem[] {
  return items.map((item) =>
    item.kind === 'text' ? item.text : { type: 'image_url', image_url: { url: item.dataUrl } },
  );
}

export function questionDraftsToRecord(drafts: QuestionDraft[]): Record<string, DecisionQuestion> {
  const record: Record<string, DecisionQuestion> = Object.create(null);

  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) continue;

    if (draft.type === 'noul') {
      record[name] = {
        type: 'noul',
        instructions: draft.instructions,
        criteria: { true: draft.criteriaTrue, false: draft.criteriaFalse },
      };
    } else if (draft.type === 'choice') {
      const criteria: Record<string, string> = Object.create(null);
      for (const option of draft.options) {
        const key = option.key.trim();
        if (!key) continue;
        criteria[key] = option.description;
      }
      record[name] = { type: 'choice', instructions: draft.instructions, criteria };
    } else {
      record[name] = { type: 'score', instructions: draft.instructions, criteria: draft.labels.map((label) => label.text) };
    }
  }

  return record;
}

export function buildDecisionRequestObject(stateItems: StateItem[], drafts: QuestionDraft[]): DecisionRequestObject {
  return { state: stateItemsToDecisionState(stateItems), questions: questionDraftsToRecord(drafts) };
}

function isValidStateEntry(item: unknown): item is DecisionStateItem {
  if (typeof item === 'string') return true;
  if (typeof item !== 'object' || item === null) return false;
  const candidate = item as { type?: unknown; image_url?: { url?: unknown } };
  return candidate.type === 'image_url' && typeof candidate.image_url?.url === 'string';
}

function isValidQuestionEntry(value: unknown): value is DecisionQuestion {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { type?: unknown; instructions?: unknown; criteria?: unknown };
  if (typeof candidate.instructions !== 'string') return false;

  if (candidate.type === 'noul') {
    const criteria = candidate.criteria as { true?: unknown; false?: unknown } | undefined;
    return typeof criteria?.true === 'string' && typeof criteria?.false === 'string';
  }
  if (candidate.type === 'choice') {
    if (typeof candidate.criteria !== 'object' || candidate.criteria === null) return false;
    return Object.values(candidate.criteria).every((description) => typeof description === 'string');
  }
  if (candidate.type === 'score') {
    return Array.isArray(candidate.criteria) && candidate.criteria.every((label) => typeof label === 'string');
  }
  return false;
}

export function parseDecisionRequestObject(raw: string): { stateItems: StateItem[]; questions: QuestionDraft[] } | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) return null;
    const { state, questions } = parsed as { state?: unknown; questions?: unknown };
    if (!Array.isArray(state)) return null;
    if (typeof questions !== 'object' || questions === null) return null;
    if (!state.every(isValidStateEntry)) return null;
    if (!Object.values(questions).every(isValidQuestionEntry)) return null;

    const stateItems: StateItem[] = (state as DecisionStateItem[]).map((item) =>
      typeof item === 'string'
        ? { id: randomUUID(), kind: 'text', text: item }
        : { id: randomUUID(), kind: 'image', dataUrl: item.image_url.url },
    );

    const questionDrafts: QuestionDraft[] = Object.entries(questions as Record<string, DecisionQuestion>).map(
      ([name, question]) => {
        const id = randomUUID();
        if (question.type === 'noul') {
          return {
            id,
            name,
            type: 'noul',
            instructions: question.instructions,
            criteriaTrue: question.criteria.true,
            criteriaFalse: question.criteria.false,
          };
        }
        if (question.type === 'choice') {
          return {
            id,
            name,
            type: 'choice',
            instructions: question.instructions,
            options: Object.entries(question.criteria).map(([key, description]) => ({
              id: randomUUID(),
              key,
              description,
            })),
          };
        }
        return {
          id,
          name,
          type: 'score',
          instructions: question.instructions,
          labels: question.criteria.map((text) => ({ id: randomUUID(), text })),
        };
      },
    );

    return { stateItems, questions: questionDrafts };
  } catch {
    return null;
  }
}
