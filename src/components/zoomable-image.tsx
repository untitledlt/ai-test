import { useState } from 'react';
import { Dialog, VisuallyHidden } from '@radix-ui/themes';
import styles from './zoomable-image.module.css';

type ZoomableImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function ZoomableImage({ src, alt, className }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={`View larger: ${alt}`}
      >
        <img src={src} alt={alt} className={className} />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="90vw" className={styles.content}>
          <VisuallyHidden>
            <Dialog.Title>{alt}</Dialog.Title>
          </VisuallyHidden>
          <img src={src} alt={alt} className={styles.fullImage} />
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
