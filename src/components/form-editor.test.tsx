import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { FormEditor } from './form-editor';

function ControlledFormEditor({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (content: string) => void;
}) {
  const [content, setContent] = useState(initialContent);
  return (
    <FormEditor
      content={content}
      onChange={(next) => {
        setContent(next);
        onChange(next);
      }}
    />
  );
}

describe('FormEditor', () => {
  it('warns about advanced tool schemas and preserves them when editing messages', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tool = { type: 'function', function: { name: 'restricted', strict: true,
      parameters: { type: 'object', additionalProperties: false,
        properties: { action: { type: 'string', enum: ['read'] } }, required: ['action'] } } };
    renderWithProviders(<ControlledFormEditor initialContent={JSON.stringify({ messages: [], tools: [tool] })} onChange={onChange} />);
    expect(screen.getByText(/Some tool schemas cannot be shown/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add message/ }));
    expect(JSON.parse(onChange.mock.lastCall![0]).tools).toEqual([tool]);
  });
  it('shows an error banner when content is not valid JSON', () => {
    renderWithProviders(<FormEditor content="{not valid" onChange={() => {}} />);
    expect(screen.getByText(/Payload is not valid JSON/)).toBeInTheDocument();
  });

  it('renders one message block per message', () => {
    const content = JSON.stringify({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] });
    renderWithProviders(<FormEditor content={content} onChange={() => {}} />);
    expect(screen.getAllByPlaceholderText('Message content')).toHaveLength(2);
  });

  it('appends a new user message when "Add message" is clicked', async () => {
    const user = userEvent.setup();
    const content = JSON.stringify({ messages: [{ role: 'user', content: 'a' }] });
    const onChange = vi.fn();
    renderWithProviders(<FormEditor content={content} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Add message/ }));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall).messages).toEqual([
      { role: 'user', content: 'a' },
      { role: 'user', content: '' },
    ]);
  });

  it('removes a message when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const content = JSON.stringify({ messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] });
    const onChange = vi.fn();
    renderWithProviders(<FormEditor content={content} onChange={onChange} />);

    const removeButtons = screen.getAllByRole('button', { name: 'Remove message' });
    await user.click(removeButtons[0]);

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall).messages).toEqual([{ role: 'user', content: 'b' }]);
  });

  it('shows defined tools without needing to be expanded', () => {
    const content = JSON.stringify({ messages: [], tools: [{ type: 'function', function: { name: 'f' } }] });
    renderWithProviders(<FormEditor content={content} onChange={() => {}} />);

    expect(screen.getByText('f')).toBeInTheDocument();
  });

  it('adds a new tool, expanded inline, when "Add tool" is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ControlledFormEditor initialContent={JSON.stringify({ messages: [], tools: [] })} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: /Add tool/ }));

    expect(onChange).toHaveBeenCalled();
    const firstCall = JSON.parse(onChange.mock.calls[0][0]);
    expect(firstCall.tools).toEqual([
      { type: 'function', function: { name: '', parameters: { type: 'object', properties: {} } } },
    ]);

    const nameField = screen.getByPlaceholderText('get_weather');
    await user.type(nameField, 'get_weather');

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall).tools).toEqual([
      { type: 'function', function: { name: 'get_weather', parameters: { type: 'object', properties: {} } } },
    ]);
  });

  it('adds the web search tool when the checkbox is checked, hidden from the dynamic tool list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ControlledFormEditor initialContent={JSON.stringify({ messages: [], tools: [] })} onChange={onChange} />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Web search' }));

    const lastCall = JSON.parse(onChange.mock.calls[onChange.mock.calls.length - 1][0]);
    expect(lastCall.tools).toEqual([{ type: 'openrouter:web_search' }]);
    expect(screen.queryByText('Untitled tool')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Web search' }));
    const finalCall = JSON.parse(onChange.mock.calls[onChange.mock.calls.length - 1][0]);
    expect(finalCall.tools).toEqual([]);
  });

  it('keeps the web search checkbox usable without ever showing the invalid-JSON banner', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ControlledFormEditor initialContent={JSON.stringify({ messages: [] })} onChange={onChange} />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Web search' }));

    expect(screen.queryByText(/Payload is not valid JSON/)).not.toBeInTheDocument();
  });

  it('removes a tool when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const tool = { type: 'function', function: { name: 'get_weather', parameters: { type: 'object', properties: {} } } };
    const content = JSON.stringify({ messages: [], tools: [tool] });
    const onChange = vi.fn();
    renderWithProviders(<FormEditor content={content} onChange={onChange} />);

    expect(screen.getByText('get_weather')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove get_weather' }));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall).tools).toEqual([]);
  });
});
