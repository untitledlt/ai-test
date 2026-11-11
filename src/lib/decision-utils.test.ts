import { describe, expect, it } from 'vitest';
import {
  stateItemsToDecisionState,
  questionDraftsToRecord,
  buildDecisionRequestObject,
  parseDecisionRequestObject,
  createDecisionTask,
  formatDecisionAnswer,
  DEFAULT_DECISION_MODEL,
} from './decision-utils';
import type { StateItem, QuestionDraft } from './decision-utils';
import type { DecisionAnswer } from '../types';

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
  it('serializes prototype-like question names and option keys as ordinary data', () => {
    const result = questionDraftsToRecord([{ id: 'a', name: '__proto__', type: 'choice',
      instructions: 'Choose', options: [{ id: 'b', key: '__proto__', description: 'Option' }] }]);
    const serialized = JSON.parse(JSON.stringify(result));
    expect(Object.hasOwn(serialized, '__proto__')).toBe(true);
    expect(Object.hasOwn(serialized.__proto__.criteria, '__proto__')).toBe(true);
    expect(serialized.__proto__.criteria.__proto__).toBe('Option');
    expect(Object.getPrototypeOf(result)).toBeNull();
  });
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

  it('returns null for a state entry that is neither a string nor an image_url block, instead of throwing', () => {
    expect(parseDecisionRequestObject(JSON.stringify({ state: [null], questions: {} }))).toBeNull();
    expect(parseDecisionRequestObject(JSON.stringify({ state: [1], questions: {} }))).toBeNull();
  });

  it('returns null for a null question entry, instead of throwing', () => {
    expect(parseDecisionRequestObject(JSON.stringify({ state: [], questions: { a: null } }))).toBeNull();
  });

  it('returns null for a noul question missing its criteria, instead of throwing', () => {
    expect(
      parseDecisionRequestObject(JSON.stringify({ state: [], questions: { a: { type: 'noul' } } })),
    ).toBeNull();
  });

  it('returns null for a question whose type is not noul/choice/score, instead of silently treating it as score', () => {
    expect(
      parseDecisionRequestObject(
        JSON.stringify({ state: [], questions: { a: { type: 'bogus', criteria: ['x'] } } }),
      ),
    ).toBeNull();
    expect(
      parseDecisionRequestObject(
        JSON.stringify({
          state: [],
          questions: { a: { type: 'nou', criteria: { true: 'y', false: 'n' } } },
        }),
      ),
    ).toBeNull();
  });
});

describe('createDecisionTask', () => {
  it('creates a blank task defaulting to DEFAULT_DECISION_MODEL, not excluded', () => {
    const task = createDecisionTask();
    expect(task).toEqual({ id: expect.any(String), model: DEFAULT_DECISION_MODEL, excluded: false });
  });

  it('gives each task a unique id', () => {
    const a = createDecisionTask();
    const b = createDecisionTask();
    expect(a.id).not.toBe(b.id);
  });
});

describe('formatDecisionAnswer', () => {
  it('formats a noul answer as a percentage', () => {
    const answer: DecisionAnswer = { type: 'noul', noul: 0.92 };
    expect(formatDecisionAnswer('matches_listing', answer)).toBe('matches_listing: 92%');
  });

  it('formats a choice answer with the winning key and its probability', () => {
    const answer: DecisionAnswer = { type: 'choice', choice: 'bikes', probabilities: { bikes: 0.8, parts: 0.2 } };
    expect(formatDecisionAnswer('category', answer)).toBe('category: bikes (80%)');
  });

  it('formats a score answer with the winning label and its probability', () => {
    const answer: DecisionAnswer = {
      type: 'score',
      score: 'Light wear',
      probabilities: { 'Like new': 0.1, 'Light wear': 0.7, 'Heavy wear': 0.2 },
    };
    expect(formatDecisionAnswer('condition', answer)).toBe('condition: Light wear (70%)');
  });
});
