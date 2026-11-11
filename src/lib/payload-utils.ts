import type { AiTestAgentPayload, Choice, Message, ToolCall, ToolDefinition } from '../types';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isToolDefinition(value: unknown): value is ToolDefinition {
  if (!isObject(value) || value.type !== 'function' || !isObject(value.function)) return false;
  if (Object.keys(value).some((key) => !['type', 'function'].includes(key))) return false;
  const fn = value.function;
  if (Object.keys(fn).some((key) => !['name', 'description', 'parameters'].includes(key))) return false;
  if (typeof fn.name !== 'string' || (fn.description !== undefined && typeof fn.description !== 'string')) return false;
  if (fn.parameters === undefined) return true;
  if (!isObject(fn.parameters)) return false;
  if (Object.keys(fn.parameters).some((key) => !['type', 'properties', 'required'].includes(key))) return false;
  if (fn.parameters.type !== undefined && fn.parameters.type !== 'object') return false;
  const { properties, required } = fn.parameters;
  if (required !== undefined && (!Array.isArray(required) || !required.every((key) => typeof key === 'string'))) return false;
  if (properties === undefined) return true;
  // More complex JSON Schemas remain in the raw payload; ToolCard only edits these types.
  return isObject(properties) && Object.values(properties).every((property) =>
    isObject(property)
    && Object.keys(property).every((key) => ['type', 'description'].includes(key))
    && (property.type === undefined || (typeof property.type === 'string'
      && ['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(property.type)))
    && (property.description === undefined || typeof property.description === 'string'));
}

function isToolCall(value: unknown): value is ToolCall {
  return isObject(value) && typeof value.id === 'string' && value.type === 'function'
    && isObject(value.function) && typeof value.function.name === 'string'
    && typeof value.function.arguments === 'string';
}

function isMessage(value: unknown): value is Message {
  return isObject(value) && typeof value.role === 'string'
    && (value.content == null || typeof value.content === 'string')
    && (value.name === undefined || typeof value.name === 'string')
    && (value.tool_call_id === undefined || typeof value.tool_call_id === 'string')
    && (value.tool_calls === undefined || (Array.isArray(value.tool_calls) && value.tool_calls.every(isToolCall)));
}

export const WEB_SEARCH_TOOL = { type: 'openrouter:web_search' } as const;

export function isWebSearchTool(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  return (value as { type?: unknown }).type === 'openrouter:web_search';
}

export function parsePayload(raw: string): AiTestAgentPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isObject(parsed) && Array.isArray(parsed.messages) && parsed.messages.every(isMessage)
      && (parsed.tools === undefined || Array.isArray(parsed.tools))
    ) {
      return parsed as AiTestAgentPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildAppendMessagesFromChoice(choice: Choice): Message[] {
  const assistantMessage: Message = {
    role: choice.message.role,
    content: choice.message.content,
    ...(choice.message.tool_calls ? { tool_calls: choice.message.tool_calls } : {}),
  };

  const toolPlaceholders: Message[] = (choice.message.tool_calls ?? []).map((call) => ({
    role: 'tool',
    content: '',
    tool_call_id: call.id,
  }));

  return [assistantMessage, ...toolPlaceholders];
}

export function formatToolCall(call: ToolCall): string {
  const name = call.function.name;
  try {
    const args: unknown = JSON.parse(call.function.arguments);
    return `${name}(${formatArgsObject(args)})`;
  } catch {
    return `${name}(${call.function.arguments})`;
  }
}

function formatArgsObject(args: unknown): string {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return formatValue(args);
  }
  const entries = Object.entries(args as Record<string, unknown>).map(
    ([key, value]) => `${key}: ${formatValue(value)}`,
  );
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return formatArgsObject(value);
  }
  return JSON.stringify(value);
}

export function findToolCallById(messages: Message[], toolCallId: string): ToolCall | undefined {
  for (const message of messages) {
    const found = message.tool_calls?.find((call) => call.id === toolCallId);
    if (found) return found;
  }
  return undefined;
}
