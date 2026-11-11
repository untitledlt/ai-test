import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { MessageBlock } from './message-block';
import type { Message } from '../types';

describe('MessageBlock', () => {
  it('calls onChange when editing the content textarea', async () => {
    const user = userEvent.setup();
    const message: Message = { role: 'user', content: 'hi' };
    const onChange = vi.fn();
    renderWithProviders(<MessageBlock message={message} allMessages={[message]} onChange={onChange} onRemove={() => {}} />);

    const textarea = screen.getByPlaceholderText('Message content');
    await user.type(textarea, '!');

    expect(onChange).toHaveBeenLastCalledWith({ role: 'user', content: 'hi!' });
  });

  it('calls onRemove when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const message: Message = { role: 'user', content: 'hi' };
    const onRemove = vi.fn();
    renderWithProviders(<MessageBlock message={message} allMessages={[message]} onChange={() => {}} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Remove message' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('skips the textarea when an assistant message has tool_calls and no content', () => {
    const message: Message = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } }],
    };
    renderWithProviders(<MessageBlock message={message} allMessages={[message]} onChange={() => {}} onRemove={() => {}} />);

    expect(screen.queryByPlaceholderText('Message content')).not.toBeInTheDocument();
    expect(screen.getByText("search({ q: 'x' })")).toBeInTheDocument();
  });

  it('renders the textarea when an assistant message has both content and tool_calls', () => {
    const message: Message = {
      role: 'assistant',
      content: 'thinking...',
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } }],
    };
    renderWithProviders(<MessageBlock message={message} allMessages={[message]} onChange={() => {}} onRemove={() => {}} />);

    expect(screen.getByPlaceholderText('Message content')).toBeInTheDocument();
    expect(screen.getByText('search({})')).toBeInTheDocument();
  });

  it('shows the originating tool call for a tool response message', () => {
    const assistantMessage: Message = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"nyc"}' } }],
    };
    const toolMessage: Message = { role: 'tool', content: '{"temp":70}', tool_call_id: 'call_1' };
    renderWithProviders(
      <MessageBlock
        message={toolMessage}
        allMessages={[assistantMessage, toolMessage]}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );

    expect(screen.getByText('Responds to:')).toBeInTheDocument();
    expect(screen.getByText("get_weather({ city: 'nyc' })")).toBeInTheDocument();
  });
});
