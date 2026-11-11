import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { RecordsPage } from './records-page';
import { putDoc } from '../db/client';
import type { AgentRecord } from '../db/types';

async function seedRecord(name: string, updatedAt: string): Promise<AgentRecord> {
  return putDoc<AgentRecord>({
    _id: `record:${crypto.randomUUID()}`,
    type: 'record',
    name,
    content: '{"messages":[]}',
    createdAt: updatedAt,
    updatedAt,
  });
}

describe('RecordsPage', () => {
  it('shows an empty state when there are no records', async () => {
    renderWithProviders(<RecordsPage />);
    expect(await screen.findByText('No records found.')).toBeInTheDocument();
  });

  it('lists seeded records', async () => {
    await seedRecord('Alpha', '2024-01-01T00:00:00.000Z');
    await seedRecord('Beta', '2024-02-01T00:00:00.000Z');

    renderWithProviders(<RecordsPage />);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('filters records by name as the user types', async () => {
    const user = userEvent.setup();
    await seedRecord('Weather agent', '2024-01-01T00:00:00.000Z');
    await seedRecord('Support bot', '2024-01-02T00:00:00.000Z');

    renderWithProviders(<RecordsPage />);
    await screen.findByText('Weather agent');

    await user.type(screen.getByPlaceholderText('Search records by name...'), 'weather');
    expect(screen.getByText('Weather agent')).toBeInTheDocument();
    expect(screen.queryByText('Support bot')).not.toBeInTheDocument();
  });

  it('deletes a record after confirming', async () => {
    const user = userEvent.setup();
    await seedRecord('To delete', '2024-01-01T00:00:00.000Z');

    renderWithProviders(<RecordsPage />);
    await screen.findByText('To delete');

    await user.click(screen.getByRole('button', { name: 'Delete record' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('No records found.')).toBeInTheDocument();
  });
});
