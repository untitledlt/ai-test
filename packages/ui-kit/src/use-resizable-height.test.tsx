import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useResizableHeight } from './use-resizable-height';

type StartDragEvent = Parameters<ReturnType<typeof useResizableHeight>['startDrag']>[0];

function fakeEvent(clientY: number): StartDragEvent {
  return { clientY, preventDefault: () => {} } as unknown as StartDragEvent;
}

function firePointerMove(clientY: number) {
  window.dispatchEvent(new PointerEvent('pointermove', { clientY }));
}

function firePointerUp() {
  window.dispatchEvent(new PointerEvent('pointerup'));
}

describe('useResizableHeight', () => {
  it('grows when dragging down for a "down" handle', () => {
    const { result } = renderHook(() => useResizableHeight(200, { min: 50, grow: 'down' }));
    act(() => result.current.startDrag(fakeEvent(100)));
    act(() => firePointerMove(150));
    expect(result.current.height).toBe(250);
    act(() => firePointerUp());
  });

  it('grows when dragging up for an "up" handle (bottom panel style)', () => {
    const { result } = renderHook(() => useResizableHeight(320, { min: 160, grow: 'up' }));
    act(() => result.current.startDrag(fakeEvent(300)));
    act(() => firePointerMove(250));
    expect(result.current.height).toBe(370);
    act(() => firePointerUp());
  });

  it('clamps to the configured minimum', () => {
    const { result } = renderHook(() => useResizableHeight(200, { min: 100, grow: 'down' }));
    act(() => result.current.startDrag(fakeEvent(100)));
    act(() => firePointerMove(-500));
    expect(result.current.height).toBe(100);
    act(() => firePointerUp());
  });

  it('clamps to the configured maximum', () => {
    const { result } = renderHook(() => useResizableHeight(200, { min: 50, max: 400, grow: 'down' }));
    act(() => result.current.startDrag(fakeEvent(100)));
    act(() => firePointerMove(10000));
    expect(result.current.height).toBe(400);
    act(() => firePointerUp());
  });

  it('stops tracking pointer movement after pointerup', () => {
    const { result } = renderHook(() => useResizableHeight(200, { min: 50, grow: 'down' }));
    act(() => result.current.startDrag(fakeEvent(100)));
    act(() => firePointerUp());
    act(() => firePointerMove(500));
    expect(result.current.height).toBe(200);
  });
});
