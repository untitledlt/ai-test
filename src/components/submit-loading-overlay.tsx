import { useEffect, useRef, useState } from 'react';
import { Flex, Text } from '@radix-ui/themes';
import styles from './submit-loading-overlay.module.css';

type SubmitLoadingOverlayProps = {
  active: boolean;
};

export function SubmitLoadingOverlay({ active }: SubmitLoadingOverlayProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    const tick = () => setElapsedMs(performance.now() - startRef.current);
    tick();
    const intervalId = setInterval(tick, 100);
    return () => clearInterval(intervalId);
  }, [active]);

  if (!active) return null;

  return (
    <Flex className={styles.overlay} align="center" justify="center" direction="column" gap="4">
      <div className={styles.spinner} />
      <Text size="6" weight="medium" className={styles.timer}>
        {(elapsedMs / 1000).toFixed(1)}s
      </Text>
    </Flex>
  );
}
