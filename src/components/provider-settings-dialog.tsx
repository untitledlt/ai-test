import { useState } from 'react';
import { Dialog, TextField, Button, Flex, Text } from '@radix-ui/themes';
import type { ProviderProfile } from '../db/types';

export type ProviderSettingsInput = {
  _id?: string;
  _rev?: string;
  label: string;
  serverURL: string;
  apiKey: string;
};

type ProviderSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: ProviderSettingsInput) => void;
  provider?: ProviderProfile | null;
};

export function ProviderSettingsDialog({ open, onOpenChange, onSave, provider }: ProviderSettingsDialogProps) {
  const [label, setLabel] = useState('');
  const [serverURL, setServerURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLabel(provider?.label ?? '');
      setServerURL(provider?.serverURL ?? '');
      setApiKey(provider?.apiKey ?? '');
    }
  }

  const canSave = label.trim() !== '' && serverURL.trim() !== '';

  function handleSave() {
    onSave({ _id: provider?._id, _rev: provider?._rev, label: label.trim(), serverURL: serverURL.trim(), apiKey });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>{provider ? 'Edit provider' : 'Add provider'}</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <label>
            <Text as="div" size="2" weight="medium" mb="1">
              Label
            </Text>
            <TextField.Root value={label} onChange={(event) => setLabel(event.target.value)} placeholder="OpenRouter" />
          </label>
          <label>
            <Text as="div" size="2" weight="medium" mb="1">
              Server URL
            </Text>
            <TextField.Root
              value={serverURL}
              onChange={(event) => setServerURL(event.target.value)}
              placeholder="https://openrouter.ai/api/v1"
            />
          </label>
          <label>
            <Text as="div" size="2" weight="medium" mb="1">
              API key
            </Text>
            <TextField.Root
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-or-..."
              type="password"
            />
          </label>
        </Flex>
        <Flex justify="end" gap="3" mt="4">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Button disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
