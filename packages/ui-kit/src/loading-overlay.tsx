import { Flex, Spinner } from '@radix-ui/themes';
import styles from './loading-overlay.module.css';

type LoadingOverlayProps = {
  active: boolean;
};

export function LoadingOverlay({ active }: LoadingOverlayProps) {
  if (!active) return null;

  return (
    <Flex className={styles.overlay} align="center" justify="center">
      <Spinner size="3" />
    </Flex>
  );
}
