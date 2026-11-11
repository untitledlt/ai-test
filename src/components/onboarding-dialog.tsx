import { useState } from 'react';
import { Badge, Button, Callout, Dialog, Flex, Heading, IconButton, Text, TextField, Tooltip } from '@radix-ui/themes';
import { Info, Play } from 'lucide-react';
import { useCompleteOnboarding } from '../hooks/use-onboarding';
import type { OnboardingChoice } from '../hooks/use-onboarding';
import styles from './onboarding-dialog.module.css';

type OnboardingDialogProps = {
  toolName: string;
  onCancel: () => void;
  onComplete: () => void;
};

export function OnboardingDialog({ toolName, onCancel, onComplete }: OnboardingDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const complete = useCompleteOnboarding();

  async function connect(choice: OnboardingChoice) {
    try {
      await complete.mutateAsync(choice);
      setApiKey('');
      onComplete();
    } catch {
      // Keep the dialog open with a safe error message and allow retrying.
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !complete.isPending) onCancel(); }}>
      <Dialog.Content maxWidth="620px" aria-busy={complete.isPending}>
        <Dialog.Title>Try AI Test</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Explore {toolName} with the demo, or connect your own OpenRouter key.
        </Dialog.Description>
        <Flex direction="column" gap="4">
          <section className={styles.section} aria-labelledby="own-key-title">
            <Heading as="h2" size="3" id="own-key-title" mb="3">Use your own API key</Heading>
            <Callout.Root size="1" color="gray" mb="3">
              <Callout.Text>
                Your key stays in this browser. Built-in OpenRouter requests send it only
                to OpenRouter, never to our demo server.
              </Callout.Text>
            </Callout.Root>
            <form onSubmit={(event) => { event.preventDefault(); if (apiKey.trim() && !complete.isPending) void connect({ mode: 'openrouter', apiKey }); }}>
              <Flex align="center" gap="2" mb="1">
                <Text as="label" htmlFor="onboarding-api-key" size="2" weight="medium">OpenRouter API key</Text>
                <Tooltip content="Use a key with a small credit limit and a short expiration date.">
                  <IconButton type="button" variant="ghost" color="gray" size="1" aria-label="API key advice">
                    <Info size={15} aria-hidden="true" />
                  </IconButton>
                </Tooltip>
              </Flex>
                <TextField.Root id="onboarding-api-key" type="password" autoComplete="off" spellCheck={false}
                  placeholder="sk-or-…" value={apiKey} disabled={complete.isPending}
                  onChange={(event) => setApiKey(event.target.value)} />
              <Text as="p" size="1" color="gray" mt="2" mb="3">
                OpenRouter usage is billed to your account.
              </Text>
              <Button type="submit" variant="soft" color="gray" disabled={!apiKey.trim() || complete.isPending}
                loading={complete.isPending && complete.variables?.mode === 'openrouter'}>
                Save key and continue
              </Button>
            </form>
          </section>
          <section className={`${styles.section} ${styles.demo}`} aria-labelledby="demo-title">
            <Flex align="center" gap="2" mb="3" wrap="wrap">
              <div className={styles.demoIcon}><Play size={24} aria-hidden="true" /></div>
              <Heading as="h2" size="6" id="demo-title">Try the demo</Heading>
            </Flex>
            <Text as="p" size="3" weight="medium" mb="2">
              Start exploring AI models. No API key needed.
            </Text>
            <Text as="p" size="2" color="gray" mb="4">
              Prompts and images go through our API, intended to use our key with
              a $0.20 weekly allowance per IP and a limited model selection. Our server stores prompts, images, outputs and IP addresses without automatic expiration.
            </Text>
            <Button size="3" className={styles.demoButton} disabled={complete.isPending}
              loading={complete.isPending && complete.variables?.mode === 'demo'}
              onClick={() => void connect({ mode: 'demo' })}>
              <Play size={18} aria-hidden="true" /> Continue with demo
            </Button>
            <Flex align="center" justify="center" gap="2" mt="3">
              <Badge color="amber">Experimental</Badge>
              <Tooltip content="Availability and server-side limits are unverified. Some tools may not work.">
                <IconButton type="button" variant="ghost" color="gray" size="1" aria-label="Experimental demo details">
                  <Info size={15} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </Flex>
          </section>
          <details className={styles.sync}>
            <summary>Privacy and key storage</summary>
            <Text as="p" size="2" mt="2">
              Keys are stored unencrypted and excluded from remote sync. Only run JavaScript
              test suites you trust: they can access browser data and the network. If you
              configure a custom provider in Settings, its key is sent to that provider instead.
            </Text>
          </details>
          <details className={styles.sync}>
            <summary>About AI Test and running locally</summary>
            <Text as="p" size="2" mt="2">
              AI Test is source available and free for noncommercial use under the PolyForm
              Noncommercial license. You can inspect the source and run it locally for those
              uses if you prefer not to trust this domain.
            </Text>
          </details>
          <details className={styles.sync}>
            <summary>About data sync option</summary>
            <Text as="p" size="2" mt="2">
              This tool uses PouchDB to store configuration, saved requests you can load again,
              and test suites in your browser. Some interface preferences use localStorage.
              You can optionally sync to your own remote CouchDB server through Settings.
              Provider profiles, API keys and connection settings are excluded from sync; saved requests and test suites are included.
            </Text>
            <Text as="p" size="2" weight="bold" mt="2">No data sync or backup is enabled by default.</Text>
            <Text as="p" size="2" mt="2">
              Clearing browser storage can delete your local data. Previously synced keys are
              not removed from old remote copies or backups.
            </Text>
          </details>
          {complete.isError && <Callout.Root color="red" role="alert"><Callout.Text>
            Could not save your connection in this browser. Please try again.
          </Callout.Text></Callout.Root>}
          <Flex justify="end">
            <Button variant="soft" color="gray" disabled={complete.isPending} onClick={onCancel}>Cancel</Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
