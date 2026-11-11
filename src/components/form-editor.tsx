import { useState } from 'react';
import { Button, Callout, Box, Flex, Text, Checkbox } from '@radix-ui/themes';
import { Plus, TriangleAlert } from 'lucide-react';
import { MessageBlock } from './message-block';
import { ToolCard } from './tool-card';
import { parsePayload, isToolDefinition, isWebSearchTool, WEB_SEARCH_TOOL } from '../lib/payload-utils';
import { randomUUID } from '../lib/uuid';
import type { Message, ToolDefinition } from '../types';

type FormEditorProps = {
  content: string;
  onChange: (content: string) => void;
};

export function FormEditor({ content, onChange }: FormEditorProps) {
  const payload = parsePayload(content);
  const toolsRaw: unknown[] = Array.isArray(payload?.tools) ? payload.tools : [];

  const [toolKeys, setToolKeys] = useState<string[]>(() => toolsRaw.map(() => randomUUID()));
  const [autoExpandKeys, setAutoExpandKeys] = useState<Set<string>>(() => new Set());

  if (toolKeys.length !== toolsRaw.length) {
    setToolKeys(toolsRaw.map(() => randomUUID()));
  }

  if (!payload) {
    return (
      <Callout.Root color="red">
        <Callout.Icon>
          <TriangleAlert size={16} />
        </Callout.Icon>
        <Callout.Text>Payload is not valid JSON or has an invalid message/tool structure. Fix it in Editor mode first.</Callout.Text>
      </Callout.Root>
    );
  }

  const messages = payload.messages;

  function updateMessages(next: Message[]) {
    onChange(JSON.stringify({ ...payload, messages: next }, null, 2));
  }

  function handleAddMessage() {
    updateMessages([...messages, { role: 'user', content: '' }]);
  }

  function persistTools(nextTools: unknown[]) {
    onChange(JSON.stringify({ ...payload, tools: nextTools }, null, 2));
  }

  function handleAddTool() {
    const newTool: ToolDefinition = {
      type: 'function',
      function: { name: '', parameters: { type: 'object', properties: {} } },
    };
    const newKey = randomUUID();
    setToolKeys([...toolKeys, newKey]);
    setAutoExpandKeys(new Set([...autoExpandKeys, newKey]));
    persistTools([...toolsRaw, newTool]);
  }

  function handleToolChange(index: number, tool: ToolDefinition) {
    persistTools(toolsRaw.map((t, i) => (i === index ? tool : t)));
  }

  function handleRemoveTool(index: number) {
    setToolKeys(toolKeys.filter((_, i) => i !== index));
    persistTools(toolsRaw.filter((_, i) => i !== index));
  }

  const hasWebSearch = toolsRaw.some(isWebSearchTool);

  function handleWebSearchToggle(checked: boolean) {
    persistTools(
      checked ? [...toolsRaw, WEB_SEARCH_TOOL] : toolsRaw.filter((tool) => !isWebSearchTool(tool)),
    );
  }

  return (
    <Flex direction="column" gap="2">
      {messages.map((message, index) => (
        <MessageBlock
          key={index}
          message={message}
          allMessages={messages}
          onChange={(next) => {
            const nextMessages = [...messages];
            nextMessages[index] = next;
            updateMessages(nextMessages);
          }}
          onRemove={() => updateMessages(messages.filter((_, i) => i !== index))}
        />
      ))}

      <Button variant="soft" onClick={handleAddMessage}>
        <Plus size={16} /> Add message
      </Button>

      <Box mt="4">
        <Text as="div" size="2" weight="medium" mb="2">
          Tools
        </Text>
        <Text as="label" size="2" mb="2" style={{ display: 'block' }}>
          <Flex gap="2" align="center">
            <Checkbox checked={hasWebSearch} onCheckedChange={(checked) => handleWebSearchToggle(checked === true)} />
            Web search
          </Flex>
        </Text>
        <Flex direction="column" gap="2" mb="2">
          {toolsRaw.some((tool) => !isToolDefinition(tool) && !isWebSearchTool(tool)) && (
            <Text size="1" color="gray">Some tool schemas cannot be shown in Form mode. They are preserved; edit them in Editor mode.</Text>
          )}
          {toolsRaw.map((tool, index) =>
            isToolDefinition(tool) ? (
              <ToolCard
                key={toolKeys[index]}
                tool={tool}
                defaultExpanded={autoExpandKeys.has(toolKeys[index])}
                onChange={(next) => handleToolChange(index, next)}
                onRemove={() => handleRemoveTool(index)}
              />
            ) : null,
          )}
        </Flex>

        <Button variant="soft" size="1" onClick={handleAddTool}>
          <Plus size={14} /> Add tool
        </Button>
      </Box>
    </Flex>
  );
}
