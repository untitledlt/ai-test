import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { DecisionRecordsPage } from './decision-records-page';
import { putDoc } from '../db/client';
import { randomUUID } from '../lib/uuid';
import type { DecisionRecord } from '../db/types';

async function seedRecord(name: string, updatedAt: string): Promise<DecisionRecord> {
  return putDoc<DecisionRecord>({
    _id: `decision:${randomUUID()}`,
    type: 'decision',
    name,
    content: '{"state":[],"questions":{}}',
    createdAt: updatedAt,
    updatedAt,
  });
}

describe('DecisionRecordsPage', () => {
  it('shows an empty state when there are no records', async () => {
    renderWithProviders(<DecisionRecordsPage />);
    expect(await screen.findByText('No records found.')).toBeInTheDocument();
  });

  it('lists seeded records', async () => {
    await seedRecord('Alpha', '2024-01-01T00:00:00.000Z');
    await seedRecord('Beta', '2024-02-01T00:00:00.000Z');

    renderWithProviders(<DecisionRecordsPage />);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('filters records by name as the user types', async () => {
    const user = userEvent.setup();
    await seedRecord('Listing check', '2024-01-01T00:00:00.000Z');
    await seedRecord('Support triage', '2024-01-02T00:00:00.000Z');

    renderWithProviders(<DecisionRecordsPage />);
    await screen.findByText('Listing check');

    await user.type(screen.getByPlaceholderText('Search records by name...'), 'listing');
    expect(screen.getByText('Listing check')).toBeInTheDocument();
    expect(screen.queryByText('Support triage')).not.toBeInTheDocument();
  });

  it('deletes a record after confirming', async () => {
    const user = userEvent.setup();
    await seedRecord('To delete', '2024-01-01T00:00:00.000Z');

    renderWithProviders(<DecisionRecordsPage />);
    await screen.findByText('To delete');

    await user.click(screen.getByRole('button', { name: 'Delete record' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('No records found.')).toBeInTheDocument();
  });
});
