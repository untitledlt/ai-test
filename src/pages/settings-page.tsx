import { useState } from 'react';
import {
  Heading,
  Table,
  IconButton,
  Button,
  Flex,
  Text,
  RadioGroup,
  Switch,
  TextField,
} from '@radix-ui/themes';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { PageLayout } from '../components/page-layout';
import { ConfirmDialog } from '../components/confirm-dialog';
import { ProviderWarning } from '../components/provider-warning';
import { toast } from 'sonner';
import {
  useProviders,
  useAppSettings,
  useSaveProvider,
  useDeleteProvider,
  useSetActiveProvider,
} from '../hooks/use-providers';
import { useSyncSettings, useUpdateSyncSettings } from '../hooks/use-sync-settings';
import { ProviderSettingsDialog } from '../components/provider-settings-dialog';
import type { ProviderSettingsInput } from '../components/provider-settings-dialog';
import { maskApiKey } from '../lib/format';
import type { ProviderProfile } from '../db/types';

export function SettingsPage() {
  const providersQuery = useProviders();
  const settingsQuery = useAppSettings();
  const saveProvider = useSaveProvider();
  const deleteProvider = useDeleteProvider();
  const setActiveProvider = useSetActiveProvider();
  const syncSettingsQuery = useSyncSettings();
  const updateSyncSettings = useUpdateSyncSettings();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderProfile | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<ProviderProfile | null>(null);
  const [syncUrlDraft, setSyncUrlDraft] = useState<string | null>(null);

  const providers = providersQuery.data ?? [];
  const activeProviderId = settingsQuery.data?.activeProviderId ?? null;
  const activeProvider = providers.find((provider) => provider._id === activeProviderId);

  function handleSave(input: ProviderSettingsInput) {
    saveProvider.mutate(input, {
      onSuccess: () => toast.success('Provider saved'),
      onError: (err) => toast.error(err.message),
    });
  }

  function handleDelete() {
    if (!deletingProvider) return;
    deleteProvider.mutate(deletingProvider, {
      onSuccess: () => toast.success('Provider deleted'),
      onError: (err) => toast.error(err.message),
    });
    setDeletingProvider(null);
  }

  const syncEnabled = syncSettingsQuery.data?.syncEnabled ?? false;
  const syncRemoteURL = syncUrlDraft ?? syncSettingsQuery.data?.syncRemoteURL ?? '';

  return (
    <PageLayout title="Settings" backPath="/agent" backLabel="Back to editor">
      <Flex justify="between" align="center" mb="3">
        <Heading size="4">Providers</Heading>
        <Button
          onClick={() => {
            setEditingProvider(null);
            setDialogOpen(true);
          }}
        >
          <Plus size={16} /> Add profile
        </Button>
      </Flex>

      <RadioGroup.Root
        value={activeProviderId ?? undefined}
        onValueChange={(id) => setActiveProvider.mutate(id)}
      >
        <Table.Root variant="surface" mb="4">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Active</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Label</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Server URL</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>API key</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell aria-label="Actions" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {providers.map((provider) => (
              <Table.Row key={provider._id}>
                <Table.Cell>
                  <RadioGroup.Item value={provider._id} />
                </Table.Cell>
                <Table.Cell>{provider.label}</Table.Cell>
                <Table.Cell>
                  <Text
                    style={{
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {provider.serverURL}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {provider.apiKey ? maskApiKey(provider.apiKey) : <Text color="gray">Not set</Text>}
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    <IconButton
                      variant="ghost"
                      onClick={() => {
                        setEditingProvider(provider);
                        setDialogOpen(true);
                      }}
                      aria-label="Edit provider"
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      color="red"
                      onClick={() => setDeletingProvider(provider)}
                      aria-label="Delete provider"
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
            {providers.length === 0 && !providersQuery.isLoading && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Text color="gray">No providers configured.</Text>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </RadioGroup.Root>

      {(!activeProviderId || !activeProvider?.apiKey) && (
        <ProviderWarning inSettings />
      )}

      <Heading size="4" mb="3">
        Sync
      </Heading>
      <Flex direction="column" gap="3" maxWidth="480px">
        <Text size="2" color="amber">
          Sync copies records and test suites to the remote server. Provider profiles, API keys and connection settings stay on this device.
          Previously synced credentials are not removed from the remote server. Use a private server you trust, with HTTPS and authentication.
        </Text>
        <label>
          <Text as="div" size="2" weight="medium" mb="1">
            Remote CouchDB URL
          </Text>
          <TextField.Root
            type="password"
            autoComplete="off"
            value={syncRemoteURL}
            placeholder="https://user:pass@host/ai-test-agent"
            onChange={(event) => setSyncUrlDraft(event.target.value)}
            onBlur={() => {
              if (syncUrlDraft !== null) {
                updateSyncSettings.mutate({ syncRemoteURL: syncUrlDraft });
              }
            }}
          />
        </label>
        <Text as="label" size="2">
          <Flex align="center" gap="2">
            <Switch
              checked={syncEnabled}
              disabled={!syncRemoteURL}
              onCheckedChange={(checked) =>
                updateSyncSettings.mutate({ syncEnabled: checked, syncRemoteURL: syncRemoteURL || undefined })
              }
            />
            Enable live sync
          </Flex>
        </Text>
        <Text size="1" color="gray">
          Optional — the app works fully offline regardless of sync state.
        </Text>
      </Flex>

      <ProviderSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSave} provider={editingProvider} />

      <ConfirmDialog
        open={deletingProvider != null}
        onOpenChange={(open) => !open && setDeletingProvider(null)}
        title="Delete provider"
        description={<>Delete "{deletingProvider?.label}"? This cannot be undone.</>}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </PageLayout>
  );
}
