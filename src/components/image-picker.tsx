import { useEffect } from 'react';
import { Box, Button, Flex, IconButton, Text } from '@radix-ui/themes';
import { ChevronDown, ChevronUp, ImagePlus, Trash2 } from 'lucide-react';
import { createInputImage } from '../lib/image-gen-utils';
import type { InputImage } from '../lib/image-gen-utils';
import { resampleImage } from '../lib/image-utils';
import { ZoomableImage } from './zoomable-image';
import styles from './state-list.module.css';

type ImagePickerProps = {
  images: InputImage[];
  onChange: (images: InputImage[]) => void;
};

export function ImagePicker({ images, onChange }: ImagePickerProps) {
  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function moveImage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const next = [...images];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  async function handleAddImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const dataUrl = await resampleImage(file);
    onChange([...images, createInputImage(dataUrl, file.name)]);
  }

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();
      resampleImage(file).then((dataUrl) => {
        onChange([...images, createInputImage(dataUrl, file.name || undefined)]);
      });
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images, onChange]);

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2" align="center">
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
        <Text size="1" color="gray">
          or paste from clipboard
        </Text>
      </Flex>

      {images.length === 0 && (
        <Text size="2" color="gray">
          No images yet
        </Text>
      )}

      {images.map((image, index) => (
        <Box key={image.id} className={styles.row}>
          <Flex gap="2" align="start">
            <Flex direction="column" gap="1">
              <IconButton
                size="1"
                variant="soft"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => moveImage(index, -1)}
              >
                <ChevronUp size={14} />
              </IconButton>
              <IconButton
                size="1"
                variant="soft"
                aria-label="Move down"
                disabled={index === images.length - 1}
                onClick={() => moveImage(index, 1)}
              >
                <ChevronDown size={14} />
              </IconButton>
            </Flex>

            <Flex direction="column" gap="1" className={styles.imageRow}>
              <ZoomableImage
                src={image.dataUrl}
                alt={image.fileName ?? 'Uploaded image'}
                className={styles.thumbnail}
              />
              {image.fileName && (
                <Text size="1" color="gray">
                  {image.fileName}
                </Text>
              )}
            </Flex>

            <IconButton
              size="1"
              color="red"
              variant="soft"
              aria-label="Remove image"
              onClick={() => removeImage(index)}
            >
              <Trash2 size={14} />
            </IconButton>
          </Flex>
        </Box>
      ))}
    </Flex>
  );
}
