import type { ReactNode } from 'react';
import styles from './dock-panel.module.css';

type DockPanelProps = {
  height: number;
  onStartResize: (event: React.PointerEvent) => void;
  children: ReactNode;
};

/** Viewport-bottom panel with a drag handle. Pair with `useResizableHeight(h, { grow: 'up' })`. */
export function DockPanel({ height, onStartResize, children }: DockPanelProps) {
  return (
    <div className={styles.panel} style={{ height }}>
      <div className={styles.handle} onPointerDown={onStartResize} title="Drag to resize panel" />
      {children}
    </div>
  );
}
