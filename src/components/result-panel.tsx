import { useState } from 'react';
import { Brain, MessageSquare, TriangleAlert } from 'lucide-react';
import { SegmentedControl, Flex, Box, Text, Button, Card, Code, Heading, Callout } from '@radix-ui/themes';
import { formatTokens, formatCost, formatDuration } from '../lib/format';
import { formatToolCall } from '../lib/payload-utils';
import { JsonEditor } from '@untitled/ui-kit';
import type { AiTestAgentResult } from '../types';
import styles from './result-panel.module.css';

type ResultPanelProps = {
  result: AiTestAgentResult | null;
  durationMs: number | null;
  onAppendToMessages: () => void;
  error?: string | null;
};

export function ResultPanel({ result, durationMs, onAppendToMessages, error }: ResultPanelProps) {
  const [view, setView] = useState<'human' | 'raw'>('human');

  if (error) {
    return (
      <Callout.Root color="red" role="alert">
        <Callout.Icon><TriangleAlert size={18} /></Callout.Icon>
        <Callout.Text><strong>Request failed</strong><br />{error}</Callout.Text>
      </Callout.Root>
    );
  }

  if (!result) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Text color="gray">Submit to see a result</Text>
      </Flex>
    );
  }

  const choice = result.choices[0];

  return (
    <Flex direction="column" gap="3" height="100%">
      <Flex gap="5" wrap="wrap">
        <Stat label="Prompt tokens" color="indigo" value={formatTokens(result.usage.prompt_tokens)} />
        <Stat label="Total tokens" color="violet" value={formatTokens(result.usage.total_tokens)} />
        <Stat label="Cost" color="green" value={formatCost(result.usage.cost)} />
        <Stat label="Duration" color="amber" value={durationMs != null ? formatDuration(durationMs) : '—'} />
      </Flex>

      <Flex justify="between" align="center">
        <SegmentedControl.Root value={view} onValueChange={(value) => setView(value as 'human' | 'raw')}>
          <SegmentedControl.Item value="human">Human readable</SegmentedControl.Item>
          <SegmentedControl.Item value="raw">Raw JSON</SegmentedControl.Item>
        </SegmentedControl.Root>
        <Button variant="soft" onClick={onAppendToMessages}>
          Append to messages
        </Button>
      </Flex>

      <Box flexGrow="1" overflow="auto">
        {view === 'human' ? (
          <Flex direction="column" gap="2">
            {choice.message.content && (
              <Card className={styles.responseCard}>
                <Flex align="center" gap="2" className={styles.sectionHeader}>
                  <MessageSquare size={16} aria-hidden="true" />
                  <Heading as="h3" size="2">Response</Heading>
                </Flex>
                <Text as="p" className={styles.sectionBody}>
                  {choice.message.content}
                </Text>
              </Card>
            )}
            {choice.message.tool_calls?.map((call) => (
              <Card key={call.id}>
                <Code size="2">{formatToolCall(call)}</Code>
              </Card>
            ))}
            {choice.message.reasoning && (
              <Card className={styles.reasoningCard}>
                <Flex align="center" gap="2" className={styles.sectionHeader}>
                  <Brain size={16} aria-hidden="true" />
                  <Heading as="h3" size="2">Reasoning</Heading>
                </Flex>
                <Text as="p" color="gray" className={styles.sectionBody}>
                  {choice.message.reasoning}
                </Text>
              </Card>
            )}
          </Flex>
        ) : (
          <Box height="100%" style={{ fontSize: 13 }}>
            <JsonEditor value={JSON.stringify(choice, null, 2)} readOnly height="100%" />
          </Box>
        )}
      </Box>
    </Flex>
  );
}

type StatColor = 'indigo' | 'violet' | 'green' | 'amber';

function Stat({ label, value, color }: { label: string; value: string; color: StatColor }) {
  return (
    <Flex direction="column" gap="1" px="3" py="2" style={{ background: `var(--${color}-a3)`, borderRadius: 'var(--radius-3)' }}>
      <Text size="1" style={{ color: `var(--${color}-11)` }}>
        {label}
      </Text>
      <Text size="4" weight="bold" style={{ color: `var(--${color}-12)` }}>
        {value}
      </Text>
    </Flex>
  );
}
