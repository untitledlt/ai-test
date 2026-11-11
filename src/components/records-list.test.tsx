import { useLocation } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { getDoc, putDoc } from '../db/client';
import { RecordsPage } from '../pages/records-page';
import { DecisionRecordsPage } from '../pages/decision-records-page';
import { ImageRecordsPage } from '../pages/image-records-page';
import { ExtractRecordsPage } from '../pages/extract-records-page';

function Location() {
  return <div>Path: {useLocation().pathname}</div>;
}

const pages = [
  { Page: RecordsPage, type: 'record', basePath: '/agent', title: 'Records', backLabel: 'Back to editor' },
  { Page: DecisionRecordsPage, type: 'decision', basePath: '/decision', title: 'Decision records', backLabel: 'Back to decision' },
  { Page: ImageRecordsPage, type: 'image-gen', basePath: '/image', title: 'Image generation records', backLabel: 'Back to image generation' },
  { Page: ExtractRecordsPage, type: 'extract', basePath: '/extract', title: 'Extraction records', backLabel: 'Back to extraction' },
] as const;

describe.each(pages)('$title shared list', ({ Page, type, basePath, title, backLabel }) => {
  it('keeps the feature-specific heading and back/record destinations', async () => {
    const user = userEvent.setup();
    const record = await putDoc({
      _id: `${type}:example`, type, name: 'Example', content: '{}',
      createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    });
    renderWithProviders(<><Page /><Location /></>, { route: `${basePath}/records` });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    await user.click(await screen.findByText('Example'));
    expect(screen.getByText(`Path: ${basePath}/${record._id}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: backLabel }));
    expect(screen.getByText(`Path: ${basePath}`)).toBeInTheDocument();
  });

  it('cancels deletion without navigating, then deletes from the correct collection', async () => {
    const user = userEvent.setup();
    const record = await putDoc({
      _id: `${type}:example`, type, name: 'Example', content: '{}',
      createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    });
    renderWithProviders(<><Page /><Location /></>, { route: `${basePath}/records` });
    await screen.findByText('Example');
    await user.click(screen.getByRole('button', { name: 'Delete record' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(`Path: ${basePath}/records`)).toBeInTheDocument();
    expect(await getDoc(record._id)).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete record' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No records found.')).toBeInTheDocument();
    expect(await getDoc(record._id)).toBeNull();
  });
});
