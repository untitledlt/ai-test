import { Select, TextArea, IconButton, Flex, Box, Text, Code } from '@radix-ui/themes';
import { Trash2 } from 'lucide-react';
import type { Message } from '../types';
import { findToolCallById, formatToolCall } from '../lib/payload-utils';
import styles from './message-block.module.css';

type MessageBlockProps = {
  message: Message;
  allMessages: Message[];
  onChange: (message: Message) => void;
  onRemove: () => void;
};

const ROLE_OPTIONS = ['system', 'user', 'assistant', 'tool'] as const;

const ROLE_COLORS: Record<string, 'indigo' | 'green' | 'amber' | 'violet'> = {
  system: 'indigo',
  user: 'green',
  assistant: 'amber',
  tool: 'violet',
};

export function MessageBlock({ message, allMessages, onChange, onRemove }: MessageBlockProps) {
  const role = typeof message.role === 'string' ? message.role : 'user';
  const originatingCall =
    role === 'tool' && message.tool_call_id ? findToolCallById(allMessages, message.tool_call_id) : undefined;

  const toolCalls = role === 'assistant' ? (message.tool_calls ?? []) : [];
  const skipTextarea = toolCalls.length > 0 && !message.content;

  return (
    <Box className={styles.block}>
      <Flex justify="between" align="center" mb="2">
        <Select.Root value={role} onValueChange={(nextRole) => onChange({ ...message, role: nextRole })}>
          <Select.Trigger variant="soft" color={ROLE_COLORS[role] ?? 'gray'} />
          <Select.Content>
            {ROLE_OPTIONS.map((option) => (
              <Select.Item key={option} value={option}>
                {option}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <IconButton color="red" variant="soft" onClick={onRemove} aria-label="Remove message">
          <Trash2 size={16} />
        </IconButton>
      </Flex>

      {originatingCall && (
        <Box className={styles.toolCallBlock} mb="2">
          <Text size="1" color="gray">
            Responds to:
          </Text>
          <Code size="2">{formatToolCall(originatingCall)}</Code>
        </Box>
      )}

      {toolCalls.map((call) => (
        <Box key={call.id} className={styles.toolCallBlock} mb="2">
          <Code size="2">{formatToolCall(call)}</Code>
        </Box>
      ))}

      {!skipTextarea && (
        <TextArea
          className={styles.textarea}
          value={message.content ?? ''}
          onChange={(event) => onChange({ ...message, content: event.target.value })}
          placeholder="Message content"
        />
      )}
    </Box>
  );
}
