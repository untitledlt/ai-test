import { useState, type FormEvent } from 'react';
import { Dialog, TextField, Button, Flex } from '@radix-ui/themes';

type SaveAsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
  initialName?: string;
};

export function SaveAsDialog({ open, onOpenChange, onSave, initialName = '' }: SaveAsDialogProps) {
  const [name, setName] = useState(initialName);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(initialName);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() === '') return;
    onSave(name.trim());
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>Save as</Dialog.Title>
        <form onSubmit={handleSubmit}>
          <TextField.Root
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Record name"
            autoFocus
          />
          <Flex justify="end" gap="3" mt="4">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={name.trim() === ''}>
              Save
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
