import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { useBlocker } from 'react-router-dom';

/** Share route and in-page discard confirmation while each editor owns its dirty snapshot. */
export function useUnsavedChanges(isDirtyRef: RefObject<boolean>) {
  const shouldBlock = useCallback(() => isDirtyRef.current, [isDirtyRef]);
  const blocker = useBlocker(shouldBlock);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  function guardedAction(action: () => void) {
    if (isDirtyRef.current) setPendingAction(() => action);
    else action();
  }

  function onOpenChange(open: boolean) {
    if (open) return;
    if (blocker.state === 'blocked') blocker.reset();
    setPendingAction(null);
  }

  function onConfirm() {
    // An approved in-page action may navigate; don't block that same action a second time.
    isDirtyRef.current = false;
    if (blocker.state === 'blocked') blocker.proceed();
    if (pendingAction) pendingAction();
    setPendingAction(null);
  }

  return {
    guardedAction,
    discardDialogProps: {
      open: blocker.state === 'blocked' || pendingAction !== null,
      onOpenChange,
      onConfirm,
      title: 'Unsaved changes',
      description: 'You have unsaved changes. Leave without saving?',
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
      destructive: true,
    },
  };
}
