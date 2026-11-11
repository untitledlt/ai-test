import type { ReactNode } from 'react';
import { AlertDialog, Button, Flex } from '@radix-ui/themes';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancel', destructive = false, onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content maxWidth="400px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
        <Flex justify="end" gap="3" mt="4">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">{cancelLabel}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color={destructive ? 'red' : undefined} onClick={onConfirm}>{confirmLabel}</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
