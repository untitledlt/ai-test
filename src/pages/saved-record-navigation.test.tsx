import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { putDoc } from '../db/client';
import type { AnyDoc } from '../db/client';
import { RecordPage } from './record-page';
import { DecisionPage } from './decision-page';
import { ImagePage } from './image-page';
import { ExtractPage } from './extract-page';

afterEach(() => localStorage.clear());

const cases = [
  { path: '/agent', param: 'recordId', type: 'record', Page: RecordPage,
    content: { messages: [{ role: 'user', content: 'Hello' }] } },
  { path: '/decision', param: 'decisionId', type: 'decision', Page: DecisionPage,
    content: { state: ['Hello'], questions: {}, tasks: [{ model: 'example' }], callCount: 1 } },
  { path: '/image', param: 'imageId', type: 'image-gen', Page: ImagePage,
    content: { prompt: 'A cat', inputImages: [], tasks: [{ model: 'example' }], callCount: 1 } },
  { path: '/extract', param: 'extractId', type: 'extract', Page: ExtractPage,
    content: { instructions: 'Extract', schema: '{}', inputImages: [], tasks: [{ model: 'example' }], callCount: 1 } },
] as const;

async function openRecord(item: typeof cases[number], options: { tab?: string; cached?: boolean } = {}) {
  const now = new Date().toISOString();
  const record = { _id: `${item.type}:test`, type: item.type, name: 'Saved example',
    content: JSON.stringify(item.content, null, 2), createdAt: now, updatedAt: now,
    ...(item.type === 'record' ? { multipleTasks: [{ id: 'task-1', model: 'example', temperature: 0.7 }], multipleCallCount: 2, multipleTestSuite: 'return [];\n' } : {}),
  } as AnyDoc;
  await putDoc(record);
  const router = createMemoryRouter([
    { path: `${item.path}/:${item.param}`, element: <item.Page /> },
    { path: '/', element: <h1>Home destination</h1> },
  ], { initialEntries: [`${item.path}/${record._id}${options.tab ? `?tab=${options.tab}` : ''}`] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (options.cached) client.setQueryData(['records', record._id], record);
  render(<StrictMode><Theme><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></Theme></StrictMode>);
  await screen.findByText('Saved example');
  return userEvent.setup();
}

describe('saved record navigation', () => {
  it.each(cases.slice(1))('does not warn when reopening a browser-stored $path draft', async ({ path, Page }) => {
    const draftKey = `ai-test-agent:${path === '/image' ? 'image-gen' : path.slice(1)}-draft`;
    const draft = {
      name: 'Restored draft', prompt: 'A cat', instructions: 'Extract the receipt', schema: '{}',
      inputImages: [], stateItems: [], questions: [],
      tasks: [{ id: 'task-1', model: 'example', excluded: false }], callCount: 2,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    const router = createMemoryRouter([
      { path, element: <Page /> },
      { path: '/', element: <h1>Home destination</h1> },
    ], { initialEntries: [path] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<StrictMode><Theme><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></Theme></StrictMode>);
    const user = userEvent.setup();
    expect(await screen.findByText('Restored draft')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Home' }));
    expect(await screen.findByText('Home destination')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(draftKey)!)).toMatchObject({ name: draft.name, callCount: 2 });
  });

  it.each(cases)('does not warn after merely loading $path', async (item) => {
    const user = await openRecord(item);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Home' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Home destination')).toBeInTheDocument();
  });

  it.each(['form', 'editor', 'multiple'])('does not warn for cached Agent in %s mode', async (mode) => {
    localStorage.setItem('ai-test-agent:editor-mode', mode === 'editor' ? 'editor' : 'form');
    const user = await openRecord(cases[0], { cached: true, tab: mode === 'multiple' ? 'multiple' : 'single' });
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Home' }));
    expect(await screen.findByText('Home destination')).toBeInTheDocument();
  });

  it('still warns when a loaded image prompt is edited', async () => {
    const user = await openRecord(cases[2]);
    fireEvent.change(screen.getByPlaceholderText('Describe the image to generate'), { target: { value: 'A different cat' } });
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Home' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Unsaved changes');
    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByPlaceholderText('Describe the image to generate')).toHaveValue('A different cat');
  });
});
