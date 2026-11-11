import { useState } from 'react';
import { Box, Button, Card, Flex, IconButton, Select, Text, TextField } from '@radix-ui/themes';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { ChoiceOption, QuestionDraft, ScoreLabel } from '../lib/decision-utils';
import { randomUUID } from '../lib/uuid';
import styles from './question-card.module.css';

type QuestionCardProps = {
  draft: QuestionDraft;
  defaultExpanded?: boolean;
  onChange: (draft: QuestionDraft) => void;
  onRemove: () => void;
};

type ChoiceOptionRowProps = {
  option: ChoiceOption;
  onChange: (option: ChoiceOption) => void;
  onRemove: () => void;
};

function ChoiceOptionRow({ option, onChange, onRemove }: ChoiceOptionRowProps) {
  return (
    <Box className={styles.optionRow}>
      <TextField.Root
        size="1"
        value={option.key}
        onChange={(event) => onChange({ ...option, key: event.target.value })}
        placeholder="Option key"
      />
      <TextField.Root
        size="1"
        value={option.description}
        onChange={(event) => onChange({ ...option, description: event.target.value })}
        placeholder="Option description"
      />
      <IconButton size="1" color="red" variant="soft" onClick={onRemove} aria-label="Remove option">
        <Trash2 size={14} />
      </IconButton>
    </Box>
  );
}

type ScoreLabelRowProps = {
  label: ScoreLabel;
  isFirst: boolean;
  isLast: boolean;
  onChange: (label: ScoreLabel) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

function ScoreLabelRow({ label, isFirst, isLast, onChange, onMove, onRemove }: ScoreLabelRowProps) {
  return (
    <Box className={styles.labelRow}>
      <TextField.Root
        size="1"
        value={label.text}
        onChange={(event) => onChange({ ...label, text: event.target.value })}
        placeholder="Label"
      />
      <IconButton size="1" variant="soft" aria-label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
        <ChevronUp size={14} />
      </IconButton>
      <IconButton size="1" variant="soft" aria-label="Move down" disabled={isLast} onClick={() => onMove(1)}>
        <ChevronDown size={14} />
      </IconButton>
      <IconButton size="1" color="red" variant="soft" onClick={onRemove} aria-label="Remove label">
        <Trash2 size={14} />
      </IconButton>
    </Box>
  );
}

export function QuestionCard({ draft, defaultExpanded = false, onChange, onRemove }: QuestionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  function handleNameChange(name: string) {
    onChange({ ...draft, name });
  }

  function handleInstructionsChange(instructions: string) {
    onChange({ ...draft, instructions });
  }

  function handleTypeChange(type: string) {
    const { id, name, instructions } = draft;
    if (type === 'noul') {
      onChange({ id, name, instructions, type: 'noul', criteriaTrue: '', criteriaFalse: '' });
    } else if (type === 'choice') {
      onChange({ id, name, instructions, type: 'choice', options: [] });
    } else if (type === 'score') {
      onChange({ id, name, instructions, type: 'score', labels: [] });
    }
  }

  function handleAddOption() {
    if (draft.type !== 'choice') return;
    onChange({ ...draft, options: [...draft.options, { id: randomUUID(), key: '', description: '' }] });
  }

  function updateOption(index: number, next: ChoiceOption) {
    if (draft.type !== 'choice') return;
    onChange({ ...draft, options: draft.options.map((option, i) => (i === index ? next : option)) });
  }

  function removeOption(index: number) {
    if (draft.type !== 'choice') return;
    onChange({ ...draft, options: draft.options.filter((_, i) => i !== index) });
  }

  function handleAddLabel() {
    if (draft.type !== 'score') return;
    onChange({ ...draft, labels: [...draft.labels, { id: randomUUID(), text: '' }] });
  }

  function updateLabel(index: number, next: ScoreLabel) {
    if (draft.type !== 'score') return;
    onChange({ ...draft, labels: draft.labels.map((label, i) => (i === index ? next : label)) });
  }

  function removeLabel(index: number) {
    if (draft.type !== 'score') return;
    onChange({ ...draft, labels: draft.labels.filter((_, i) => i !== index) });
  }

  function moveLabel(index: number, direction: -1 | 1) {
    if (draft.type !== 'score') return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draft.labels.length) return;
    const next = [...draft.labels];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange({ ...draft, labels: next });
  }

  return (
    <Card size="1">
      <Flex justify="between" align="center" gap="2">
        <Flex
          align="center"
          gap="1"
          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Text size="2" weight="medium" className={styles.summary}>
            {draft.name || 'Untitled question'}
          </Text>
        </Flex>
        <IconButton size="1" color="red" variant="soft" onClick={onRemove} aria-label={`Remove ${draft.name || 'question'}`}>
          <Trash2 size={14} />
        </IconButton>
      </Flex>

      {expanded && (
        <Flex direction="column" gap="3" mt="3" pl="2">
          <Box className={styles.fields}>
            <Text as="label" size="1" color="gray">
              Name
              <TextField.Root
                size="1"
                value={draft.name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="question_name"
              />
            </Text>
            <Text as="label" size="1" color="gray">
              Instructions
              <TextField.Root
                size="1"
                value={draft.instructions}
                onChange={(event) => handleInstructionsChange(event.target.value)}
                placeholder="What should the model decide?"
              />
            </Text>
            <Text as="label" size="1" color="gray">
              Question type
              <Select.Root value={draft.type} onValueChange={handleTypeChange}>
                <Select.Trigger aria-label="Question type" />
                <Select.Content>
                  <Select.Item value="noul">noul</Select.Item>
                  <Select.Item value="choice">choice</Select.Item>
                  <Select.Item value="score">score</Select.Item>
                </Select.Content>
              </Select.Root>
            </Text>
          </Box>

          {draft.type === 'noul' && (
            <Box className={styles.fields}>
              <Text as="label" size="1" color="gray">
                True means
                <TextField.Root
                  size="1"
                  value={draft.criteriaTrue}
                  onChange={(event) => onChange({ ...draft, criteriaTrue: event.target.value })}
                />
              </Text>
              <Text as="label" size="1" color="gray">
                False means
                <TextField.Root
                  size="1"
                  value={draft.criteriaFalse}
                  onChange={(event) => onChange({ ...draft, criteriaFalse: event.target.value })}
                />
              </Text>
            </Box>
          )}

          {draft.type === 'choice' && (
            <Flex direction="column" gap="2">
              <Flex justify="between" align="center">
                <Text size="1" weight="medium" color="gray">
                  Options
                </Text>
                <Button variant="soft" size="1" onClick={handleAddOption}>
                  <Plus size={12} /> Add option
                </Button>
              </Flex>
              {draft.options.map((option, index) => (
                <ChoiceOptionRow
                  key={option.id}
                  option={option}
                  onChange={(next) => updateOption(index, next)}
                  onRemove={() => removeOption(index)}
                />
              ))}
            </Flex>
          )}

          {draft.type === 'score' && (
            <Flex direction="column" gap="2">
              <Flex justify="between" align="center">
                <Text size="1" weight="medium" color="gray">
                  Labels
                </Text>
                <Button variant="soft" size="1" onClick={handleAddLabel}>
                  <Plus size={12} /> Add label
                </Button>
              </Flex>
              {draft.labels.map((label, index) => (
                <ScoreLabelRow
                  key={label.id}
                  label={label}
                  isFirst={index === 0}
                  isLast={index === draft.labels.length - 1}
                  onChange={(next) => updateLabel(index, next)}
                  onMove={(direction) => moveLabel(index, direction)}
                  onRemove={() => removeLabel(index)}
                />
              ))}
            </Flex>
          )}
        </Flex>
      )}
    </Card>
  );
}
