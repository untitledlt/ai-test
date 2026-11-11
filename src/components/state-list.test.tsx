import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { StateList } from './state-list';
import type { StateItem } from '../lib/decision-utils';

vi.mock('../lib/image-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/image-utils')>()),
  resampleImage: vi.fn().mockResolvedValue('data:image/png;base64,AAA'),
}));

function ControlledStateList({
  initialItems,
  onChange,
}: {
  initialItems: StateItem[];
  onChange: (items: StateItem[]) => void;
}) {
  const [items, setItems] = useState(initialItems);
  return (
    <StateList
      items={items}
      onChange={(next) => {
        setItems(next);
        onChange(next);
      }}
    />
  );
}

describe('StateList', () => {
  it('shows a placeholder when there are no items', () => {
    renderWithProviders(<StateList items={[]} onChange={() => {}} />);
    expect(screen.getByText('No state items yet')).toBeInTheDocument();
  });

  it('adds a text item when "Add text" is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<StateList items={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Add text' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'text', text: '' }),
    ]);
  });

  it('calls onChange with the edited text as the user types', async () => {
    const user = userEvent.setup();
    const items: StateItem[] = [{ id: '1', kind: 'text', text: '' }];
    const onChange = vi.fn();
    renderWithProviders(<ControlledStateList initialItems={items} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'hi');

    expect(onChange).toHaveBeenLastCalledWith([{ id: '1', kind: 'text', text: 'hi' }]);
  });

  it('removes an item when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const items: StateItem[] = [{ id: '1', kind: 'text', text: 'keep me' }];
    const onChange = vi.fn();
    renderWithProviders(<StateList items={items} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('moves an item down when its move-down button is clicked', async () => {
    const user = userEvent.setup();
    const items: StateItem[] = [
      { id: '1', kind: 'text', text: 'first' },
      { id: '2', kind: 'text', text: 'second' },
    ];
    const onChange = vi.fn();
    renderWithProviders(<StateList items={items} onChange={onChange} />);

    await user.click(screen.getAllByRole('button', { name: /move down/i })[0]);

    expect(onChange).toHaveBeenCalledWith([items[1], items[0]]);
  });

  it('adds an image item from a chosen file, resampling it via resampleImage', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<StateList items={[]} onChange={onChange} />);

    const file = new File(['fake-bytes'], 'bike.png', { type: 'image/png' });
    const input = screen.getByLabelText('Add image') as HTMLInputElement;
    await user.upload(input, file);

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ kind: 'image', fileName: 'bike.png' }),
      ]),
    );
  });
});
