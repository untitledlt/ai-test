import { useCallback, useEffect, useRef, useState } from 'react';

type Grow = 'up' | 'down';

type UseResizableHeightOptions = {
  min?: number;
  max?: number;
  grow?: Grow;
};

/**
 * Shared drag-resize logic for a height handle. `grow: 'down'` is a textarea-style handle
 * (drag down to grow); `grow: 'up'` is a bottom-pinned panel handle (drag up to grow).
 */
export function useResizableHeight(initialHeight: number, options: UseResizableHeightOptions = {}) {
  const { min = 100, max = Infinity, grow = 'down' } = options;
  const [height, setHeight] = useState(initialHeight);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const configRef = useRef({ min, max, grow });

  useEffect(() => {
    configRef.current = { min, max, grow };
  }, [min, max, grow]);

  const handleMove = useCallback((event: PointerEvent) => {
    if (!dragRef.current) return;
    const { min, max, grow } = configRef.current;
    const deltaY = event.clientY - dragRef.current.startY;
    const signedDelta = grow === 'up' ? -deltaY : deltaY;
    setHeight(clamp(dragRef.current.startHeight + signedDelta, min, max));
  }, []);

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      dragRef.current = { startY: event.clientY, startHeight: height };
      const controller = new AbortController();
      window.addEventListener('pointermove', handleMove, { signal: controller.signal });
      window.addEventListener(
        'pointerup',
        () => {
          dragRef.current = null;
          controller.abort();
        },
        { signal: controller.signal },
      );
    },
    [height, handleMove],
  );

  return { height, setHeight, startDrag };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
