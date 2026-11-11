import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { ModelAutoComplete } from './model-autocomplete';
import { allDocsByPrefix, putDoc } from '../db/client';
import type { CustomModel } from '../db/types';

function ControlledModelAutoComplete({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <ModelAutoComplete
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

async function seedModel(value: string) {
  return putDoc<CustomModel>({
    _id: `model:${crypto.randomUUID()}`,
    type: 'model',
    value,
    createdAt: new Date().toISOString(),
  });
}

describe('ModelAutoComplete', () => {
  it('shows no suggestions when the field is focused and no models are saved yet', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelAutoComplete value="" onChange={() => {}} />);

    await user.click(screen.getByPlaceholderText('Model'));
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('shows previously saved models when the field is focused', async () => {
    const user = userEvent.setup();
    await seedModel('anthropic/claude-sonnet-5');
    await seedModel('openai/gpt-4o-mini');

    renderWithProviders(<ModelAutoComplete value="" onChange={() => {}} />);
    await user.click(screen.getByPlaceholderText('Model'));

    await waitFor(() => expect(screen.getByText('anthropic/claude-sonnet-5')).toBeInTheDocument());
    expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
  });

  it('filters suggestions as the user types', async () => {
    const user = userEvent.setup();
    await seedModel('anthropic/claude-haiku-4.5');
    await seedModel('openai/gpt-4o-mini');

    renderWithProviders(<ControlledModelAutoComplete />);
    await user.type(screen.getByPlaceholderText('Model'), 'haiku');

    await waitFor(() => expect(screen.getByText('anthropic/claude-haiku-4.5')).toBeInTheDocument());
    expect(screen.queryByText('openai/gpt-4o-mini')).not.toBeInTheDocument();
  });

  it('calls onChange when a suggestion is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await seedModel('anthropic/claude-sonnet-5');

    renderWithProviders(<ModelAutoComplete value="" onChange={onChange} />);
    await user.click(screen.getByPlaceholderText('Model'));
    await waitFor(() => expect(screen.getByText('anthropic/claude-sonnet-5')).toBeInTheDocument());
    await user.click(screen.getByText('anthropic/claude-sonnet-5'));

    expect(onChange).toHaveBeenCalledWith('anthropic/claude-sonnet-5');
  });

  it('reopens the suggestion list on click after a selection closed it, without losing focus', async () => {
    const user = userEvent.setup();
    await seedModel('anthropic/claude-sonnet-5');
    await seedModel('anthropic/claude-haiku-4.5');

    renderWithProviders(<ControlledModelAutoComplete />);

    const field = screen.getByPlaceholderText('Model');
    await user.click(field);
    await waitFor(() => expect(screen.getByText('anthropic/claude-sonnet-5')).toBeInTheDocument());
    await user.click(screen.getByText('anthropic/claude-sonnet-5'));
    expect(screen.queryByText('anthropic/claude-haiku-4.5')).not.toBeInTheDocument();

    await user.click(field);
    expect(screen.getByText('anthropic/claude-haiku-4.5')).toBeInTheDocument();
  });

  it('accepts arbitrary free-text values not in the suggestion list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ControlledModelAutoComplete onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('Model'), 'my/custom-model');
    expect(onChange).toHaveBeenLastCalledWith('my/custom-model');
    expect(screen.getByDisplayValue('my/custom-model')).toBeInTheDocument();
  });

  it('persists a newly typed custom model to the local database once the field is left', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ControlledModelAutoComplete />
        <button>elsewhere</button>
      </>,
    );

    await user.type(screen.getByPlaceholderText('Model'), 'my/custom-model');
    await user.click(screen.getByText('elsewhere'));

    await waitFor(async () => {
      const saved = await allDocsByPrefix<CustomModel>('model:');
      expect(saved.some((model) => model.value === 'my/custom-model')).toBe(true);
    });
  });

  it('does not create a duplicate entry if the same custom model is saved again', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ControlledModelAutoComplete />
        <button>elsewhere</button>
      </>,
    );

    await user.type(screen.getByPlaceholderText('Model'), 'my/custom-model');
    await user.click(screen.getByText('elsewhere'));
    await waitFor(async () => {
      const saved = await allDocsByPrefix<CustomModel>('model:');
      expect(saved).toHaveLength(1);
    });

    await user.click(screen.getByPlaceholderText('Model'));
    await user.click(screen.getByText('elsewhere'));

    const saved = await allDocsByPrefix<CustomModel>('model:');
    expect(saved).toHaveLength(1);
  });

  it('suggests from a given list instead of custom models when suggestions is provided', async () => {
    const user = userEvent.setup();
    await seedModel('anthropic/claude-sonnet-5');

    renderWithProviders(
      <ModelAutoComplete value="" onChange={() => {}} suggestions={['google/gemini-image', 'openai/gpt-image']} />,
    );
    await user.click(screen.getByPlaceholderText('Model'));

    await waitFor(() => expect(screen.getByText('google/gemini-image')).toBeInTheDocument());
    expect(screen.getByText('openai/gpt-image')).toBeInTheDocument();
    expect(screen.queryByText('anthropic/claude-sonnet-5')).not.toBeInTheDocument();
  });

  it('does not persist a typed value as a custom model when suggestions is provided', async () => {
    const user = userEvent.setup();
    function ControlledWithSuggestions() {
      const [value, setValue] = useState('');
      return (
        <>
          <ModelAutoComplete value={value} onChange={setValue} suggestions={['google/gemini-image']} />
          <button>elsewhere</button>
        </>
      );
    }
    renderWithProviders(<ControlledWithSuggestions />);

    await user.type(screen.getByPlaceholderText('Model'), 'my/free-typed-model');
    await user.click(screen.getByText('elsewhere'));

    const saved = await allDocsByPrefix<CustomModel>('model:');
    expect(saved.some((model) => model.value === 'my/free-typed-model')).toBe(false);
  });

  it('shows a price next to a suggestion when priceByValue has an entry for it', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ModelAutoComplete
        value=""
        onChange={() => {}}
        suggestions={['google/gemini-image', 'openai/gpt-image']}
        priceByValue={new Map([['google/gemini-image', 'from $0.0184/image']])}
      />,
    );
    await user.click(screen.getByPlaceholderText('Model'));

    await waitFor(() => expect(screen.getByText('google/gemini-image')).toBeInTheDocument());
    expect(screen.getByText('from $0.0184/image')).toBeInTheDocument();
    expect(screen.getByText('openai/gpt-image')).toBeInTheDocument();
  });

  it('removes a custom model from the suggestion list and the database', async () => {
    const user = userEvent.setup();
    await seedModel('my/removable-model');

    renderWithProviders(<ModelAutoComplete value="" onChange={() => {}} />);
    await user.click(screen.getByPlaceholderText('Model'));
    await waitFor(() => expect(screen.getByText('my/removable-model')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Remove my/removable-model' }));

    await waitFor(() => expect(screen.queryByText('my/removable-model')).not.toBeInTheDocument());
    const saved = await allDocsByPrefix<CustomModel>('model:');
    expect(saved.some((model) => model.value === 'my/removable-model')).toBe(false);
  });
});
