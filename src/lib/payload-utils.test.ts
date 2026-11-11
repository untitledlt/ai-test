import { describe, expect, it } from 'vitest';
import { buildAppendMessagesFromChoice, findToolCallById, formatToolCall, isToolDefinition, parsePayload } from './payload-utils';
import type { Choice, Message, ToolCall } from '../types';

describe('parsePayload', () => {
  it.each([
    { messages: [null] },
    { messages: ['user'] },
    { messages: [{ content: 'missing role' }] },
    { messages: [{ role: 'user', content: { text: 'wrong shape' } }] },
    { messages: [{ role: 'assistant', tool_calls: {} }] },
    { messages: [{ role: 'assistant', tool_calls: [null] }] },
    { messages: [{ role: 'assistant', tool_calls: [{ id: '1', type: 'function', function: {} }] }] },
    { messages: [], tools: {} },
  ])('rejects malformed message/tool shapes without crashing: %j', (payload) => {
    expect(parsePayload(JSON.stringify(payload))).toBeNull();
  });

  it('preserves optional message fields, tool calls, and provider-specific tools', () => {
    const payload = { messages: [{ role: 'assistant', content: null,
      tool_calls: [{ id: 'call', type: 'function', function: { name: 'lookup', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'call', content: 'done' }], tools: [{ type: 'openrouter:web_search' }] };
    expect(parsePayload(JSON.stringify(payload))).toEqual(payload);
  });
  it('parses a valid payload', () => {
    const result = parsePayload('{"messages":[{"role":"user","content":"hi"}]}');
    expect(result).toEqual({ messages: [{ role: 'user', content: 'hi' }] });
  });

  it('returns null for invalid JSON', () => {
    expect(parsePayload('{not json')).toBeNull();
  });

  it('returns null when messages is not an array', () => {
    expect(parsePayload('{"messages": "nope"}')).toBeNull();
  });

  it('returns null when messages is missing', () => {
    expect(parsePayload('{}')).toBeNull();
  });
});

describe('isToolDefinition', () => {
  it.each([
    { name: 'f', description: {} },
    { name: 'f', parameters: { required: {} } },
    { name: 'f', parameters: { properties: { x: null } } },
    { name: 'f', parameters: { properties: { x: { type: ['string', 'null'] } } } },
    { name: 'f', parameters: { properties: { x: { type: ['string'] } } } },
    { name: 'f', parameters: { properties: { x: { type: 'string', enum: ['allowed'] } } } },
    { name: 'f', parameters: { type: 'object', additionalProperties: false, properties: {} } },
    { name: 'f', strict: true, parameters: { type: 'object', properties: {} } },
  ])('keeps schemas the form cannot edit out of ToolCard: %j', (fn) => {
    expect(isToolDefinition({ type: 'function', function: fn })).toBe(false);
  });
});

describe('buildAppendMessagesFromChoice', () => {
  it('builds an assistant message with no tool calls', () => {
    const choice: Choice = {
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content: 'hello there' },
    };
    expect(buildAppendMessagesFromChoice(choice)).toEqual([{ role: 'assistant', content: 'hello there' }]);
  });

  it('adds one empty tool placeholder per tool call, matched by tool_call_id', () => {
    const toolCalls: ToolCall[] = [
      { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{}' } },
      { id: 'call_2', type: 'function', function: { name: 'get_time', arguments: '{}' } },
    ];
    const choice: Choice = {
      index: 0,
      finish_reason: 'tool_calls',
      message: { role: 'assistant', content: null, tool_calls: toolCalls },
    };
    const result = buildAppendMessagesFromChoice(choice);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: 'assistant', content: null, tool_calls: toolCalls });
    expect(result[1]).toEqual({ role: 'tool', content: '', tool_call_id: 'call_1' });
    expect(result[2]).toEqual({ role: 'tool', content: '', tool_call_id: 'call_2' });
  });
});

describe('formatToolCall', () => {
  it('formats an object argument', () => {
    const call: ToolCall = {
      id: 'call_1',
      type: 'function',
      function: { name: 'search', arguments: '{"query":"hello","limit":5}' },
    };
    expect(formatToolCall(call)).toBe("search({ query: 'hello', limit: 5 })");
  });

  it('escapes quotes and backslashes in string values', () => {
    const call: ToolCall = {
      id: 'call_1',
      type: 'function',
      function: { name: 'log', arguments: JSON.stringify({ message: "it's a \\test" }) },
    };
    expect(formatToolCall(call)).toBe("log({ message: 'it\\'s a \\\\test' })");
  });

  it('formats array and nested object arguments', () => {
    const call: ToolCall = {
      id: 'call_1',
      type: 'function',
      function: { name: 'update', arguments: JSON.stringify({ tags: ['a', 'b'], nested: { x: 1 } }) },
    };
    expect(formatToolCall(call)).toBe("update({ tags: ['a', 'b'], nested: { x: 1 } })");
  });

  it('falls back to the raw string when arguments are not valid JSON', () => {
    const call: ToolCall = { id: 'call_1', type: 'function', function: { name: 'run', arguments: 'not json' } };
    expect(formatToolCall(call)).toBe('run(not json)');
  });
});

describe('findToolCallById', () => {
  it('finds a tool call nested in an earlier assistant message', () => {
    const toolCall: ToolCall = { id: 'call_1', type: 'function', function: { name: 'f', arguments: '{}' } };
    const messages: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: null, tool_calls: [toolCall] },
    ];
    expect(findToolCallById(messages, 'call_1')).toBe(toolCall);
  });

  it('returns undefined when no match exists', () => {
    const messages: Message[] = [{ role: 'user', content: 'hi' }];
    expect(findToolCallById(messages, 'missing')).toBeUndefined();
  });
});
