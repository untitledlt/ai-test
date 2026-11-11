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
});
