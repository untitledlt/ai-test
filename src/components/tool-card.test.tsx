import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { ToolCard } from './tool-card';
import type { ToolDefinition } from '../types';

const BASE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Gets the weather',
    parameters: {
      type: 'object',
      properties: { location: { type: 'string', description: 'City name' } },
      required: ['location'],
    },
  },
};

describe('ToolCard', () => {
  it('preserves __proto__ property names without changing the schema dictionary prototype', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ToolCard tool={BASE_TOOL} defaultExpanded onChange={onChange} onRemove={() => {}} />);
    await user.clear(screen.getByPlaceholderText('Property name'));
    await user.type(screen.getByPlaceholderText('Property name'), '__proto__');
    const properties = onChange.mock.lastCall![0].function.parameters.properties;
    expect(Object.getPrototypeOf(properties)).toBeNull();
    expect(JSON.parse(JSON.stringify(properties))).toEqual(JSON.parse('{"__proto__":{"type":"string","description":"City name"}}'));
  });
  it('renders collapsed by default, showing only the name and description', () => {
    renderWithProviders(<ToolCard tool={BASE_TOOL} onChange={() => {}} onRemove={() => {}} />);

    expect(screen.getByText('get_weather')).toBeInTheDocument();
    expect(screen.getByText('Gets the weather')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('get_weather')).not.toBeInTheDocument();
  });

  it('expands to show the editable fields when the header is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToolCard tool={BASE_TOOL} onChange={() => {}} onRemove={() => {}} />);

    await user.click(screen.getByText('get_weather'));

    expect(screen.getByDisplayValue('get_weather')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Gets the weather')).toBeInTheDocument();
    expect(screen.getByDisplayValue('location')).toBeInTheDocument();
    expect(screen.getByDisplayValue('City name')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('starts expanded when defaultExpanded is set', () => {
    renderWithProviders(<ToolCard tool={BASE_TOOL} defaultExpanded onChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByDisplayValue('get_weather')).toBeInTheDocument();
  });

  it('calls onChange live as the name field is edited', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const emptyTool: ToolDefinition = {
      type: 'function',
      function: { name: '', parameters: { type: 'object', properties: {} } },
    };
    renderWithProviders(<ToolCard tool={emptyTool} defaultExpanded onChange={onChange} onRemove={() => {}} />);

    await user.type(screen.getByPlaceholderText('get_weather'), 'x');

    expect(onChange).toHaveBeenCalledWith({
      type: 'function',
      function: { name: 'x', parameters: { type: 'object', properties: {} } },
    });
  });

  it('adds a required property with a type and description', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const emptyTool: ToolDefinition = {
      type: 'function',
      function: { name: 'f', parameters: { type: 'object', properties: {} } },
    };
    renderWithProviders(<ToolCard tool={emptyTool} defaultExpanded onChange={onChange} onRemove={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Add property/ }));
    await user.type(screen.getByPlaceholderText('Property name'), 'location');
    await user.type(screen.getByPlaceholderText('Property description'), 'City name');
    await user.click(screen.getByRole('checkbox'));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toEqual({
      type: 'function',
      function: {
        name: 'f',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string', description: 'City name' } },
          required: ['location'],
        },
      },
    });
  });

  it('removes a property when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ToolCard tool={BASE_TOOL} defaultExpanded onChange={onChange} onRemove={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Remove property' }));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.function.parameters.properties).toEqual({});
    expect(screen.queryByPlaceholderText('Property name')).not.toBeInTheDocument();
  });

  it('calls onRemove when the remove-tool button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProviders(<ToolCard tool={BASE_TOOL} onChange={() => {}} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Remove get_weather' }));
    expect(onRemove).toHaveBeenCalled();
  });
});
