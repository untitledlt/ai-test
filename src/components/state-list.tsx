import { Box, Button, Flex, IconButton, Text, TextArea } from '@radix-ui/themes';
import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { createImageStateItem, createTextStateItem } from '../lib/decision-utils';
import type { StateItem } from '../lib/decision-utils';
import { resampleImage } from '../lib/image-utils';
import styles from './state-list.module.css';

type StateListProps = {
  items: StateItem[];
  onChange: (items: StateItem[]) => void;
};

export function StateList({ items, onChange }: StateListProps) {
  function updateItem(index: number, next: StateItem) {
    onChange(items.map((item, i) => (i === index ? next : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  async function handleAddImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const dataUrl = await resampleImage(file);
    onChange([...items, createImageStateItem(dataUrl, file.name)]);
  }

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2">
        <Button variant="soft" size="1" onClick={() => onChange([...items, createTextStateItem()])}>
          <Plus size={14} /> Add text
        </Button>
        <Button variant="soft" size="1" asChild>
          <label>
            <ImagePlus size={14} /> Add image
            <input
              type="file"
              accept="image/*"
              aria-label="Add image"
              className={styles.hiddenFileInput}
              onChange={handleAddImage}
            />
          </label>
        </Button>
      </Flex>

      {items.length === 0 && (
        <Text size="2" color="gray">
          No state items yet
        </Text>
      )}

      {items.map((item, index) => (
        <Box key={item.id} className={styles.row}>
          <Flex gap="2" align="start">
            <Flex direction="column" gap="1">
              <IconButton
                size="1"
                variant="soft"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => moveItem(index, -1)}
              >
                <ChevronUp size={14} />
              </IconButton>
              <IconButton
                size="1"
                variant="soft"
                aria-label="Move down"
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, 1)}
              >
                <ChevronDown size={14} />
              </IconButton>
            </Flex>

            {item.kind === 'text' ? (
              <TextArea
                className={styles.textarea}
                value={item.text}
                onChange={(event) => updateItem(index, { ...item, text: event.target.value })}
                placeholder="State text"
              />
            ) : (
              <Flex direction="column" gap="1" className={styles.imageRow}>
                <img src={item.dataUrl} alt={item.fileName ?? 'Uploaded image'} className={styles.thumbnail} />
                {item.fileName && (
                  <Text size="1" color="gray">
                    {item.fileName}
                  </Text>
                )}
              </Flex>
            )}

            <IconButton
              size="1"
              color="red"
              variant="soft"
              aria-label="Remove state item"
              onClick={() => removeItem(index)}
            >
              <Trash2 size={14} />
            </IconButton>
          </Flex>
        </Box>
      ))}
    </Flex>
  );
}
