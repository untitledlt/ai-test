import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { putDoc } from '../db/client';
import { RecordPage } from './record-page';
import { ImagePage } from './image-page';
import { ExtractPage } from './extract-page';
import { DecisionPage } from './decision-page';
import { submitCompletion, submitDecision, submitExtraction, submitImageGeneration } from '../lib/openrouter-client';

vi.mock('../lib/openrouter-client', () => ({
  submitCompletion: vi.fn(), submitDecision: vi.fn(), submitExtraction: vi.fn(), submitImageGeneration: vi.fn(),
  listChatModelOptions: vi.fn().mockResolvedValue([]), listVisionModelOptions: vi.fn().mockResolvedValue([]),
  listDecisionModelOptions: vi.fn().mockResolvedValue([]), listImageModelOptions: vi.fn().mockResolvedValue([]),
  getCheapestImageOutputPrice: vi.fn().mockResolvedValue(undefined),
}));
const task = { id: 'first', model: '', excluded: false };
const cases = [
  { name: 'images', Page: ImagePage, key: 'image-gen', draft: { prompt: 'A cat', inputImages: [] } },
  { name: 'extraction', Page: ExtractPage, key: 'extract', draft: { instructions: 'Extract', schema: '{}', inputImages: [{ id: 'image', dataUrl: 'data:image/png;base64,aGVsbG8=' }] } },
  { name: 'decisions', Page: DecisionPage, key: 'decision', draft: { stateItems: [{ id: 'text', kind: 'text', text: 'A ticket' }], questions: [{ id: 'q', name: 'ok', type: 'noul', instructions: 'OK?', criteriaTrue: 'Yes', criteriaFalse: 'No' }] } },
];
beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks();
  await putDoc({ _id: 'provider:model-test', type: 'provider', label: 'Test', serverURL: 'https://example.test', apiKey: 'dummy', createdAt: '', updatedAt: '' });
  await putDoc({ _id: 'app-settings', type: 'settings', activeProviderId: 'provider:model-test', syncEnabled: false });
});
afterEach(() => localStorage.clear());
function expectNoGeneration() {
  for (const submit of [submitCompletion, submitDecision, submitExtraction, submitImageGeneration]) expect(submit).not.toHaveBeenCalled();
}
describe('required model selection', () => {
  it('disables single Submit for empty/whitespace/cleared models, including Ctrl+Enter', async () => {
    renderWithProviders(<RecordPage />);
    const field = await screen.findByPlaceholderText('Model');
    const submit = screen.getByRole('button', { name: 'Submit' });
    await waitFor(() => expect(submit).toBeDisabled());
    fireEvent.change(field, { target: { value: 'test/model' } });
    await waitFor(() => expect(submit).toBeEnabled());
    for (const value of ['   ', '']) {
      fireEvent.change(field, { target: { value } });
      expect(submit).toBeDisabled();
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    }
    expectNoGeneration();
  });
  it.each(cases)('requires a model for every active $name task while allowing excluded blanks', async ({ Page, key, draft }) => {
    localStorage.setItem(`ai-test-agent:${key}-draft`, JSON.stringify({ name: 'Ready', ...draft, tasks: [task, { ...task, id: 'second', model: 'test/other' }], callCount: 1 }));
    renderWithProviders(<Page />);
    const fields = await screen.findAllByPlaceholderText('Model');
    const start = screen.getByRole('button', { name: 'Start' });
    await waitFor(() => expect(start).toBeDisabled());
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    fireEvent.change(fields[0], { target: { value: 'test/model' } });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.change(fields[0], { target: { value: '  ' } });
    expect(start).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    await userEvent.setup().click(screen.getAllByRole('checkbox')[0]);
    expect(start).toBeEnabled();
    await userEvent.setup().click(screen.getAllByRole('checkbox')[1]);
    expect(start).toBeDisabled();
    expectNoGeneration();
  });
  it('requires models for active saved chat batch tasks', async () => {
    await putDoc({ _id: 'record:model-test', type: 'record', name: 'Saved', content: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }), multipleTasks: [{ ...task, temperature: 0.7 }, { ...task, id: 'second', model: 'test/model', temperature: 0.7 }], multipleCallCount: 1, createdAt: '', updatedAt: '' });
    renderWithProviders(<RecordPage />, { path: '/agent/:recordId', route: '/agent/record:model-test?tab=multiple' });
    const fields = await screen.findAllByPlaceholderText('Model');
    const start = screen.getByRole('button', { name: 'Start' });
    await waitFor(() => expect(start).toBeDisabled());
    fireEvent.change(fields[0], { target: { value: 'test/model' } });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.change(fields[0], { target: { value: '' } });
    expect(start).toBeDisabled();
    await userEvent.setup().click(screen.getAllByRole('checkbox')[0]);
    expect(start).toBeEnabled();
    expectNoGeneration();
  });
});

describe('visible request errors', () => {
  const message = 'OpenRouter could not complete the demo request.';
  it('shows failed requests in Agent multiple-call results', async () => {
    vi.mocked(submitCompletion).mockRejectedValueOnce(new Error(message));
    await putDoc({
      _id: 'record:error-test', type: 'record', name: 'Saved',
      content: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
      multipleTasks: [{ ...task, model: 'example', temperature: 0.7 }],
      multipleCallCount: 1, createdAt: '', updatedAt: '',
    });
    renderWithProviders(<RecordPage />, { path: '/agent/:recordId', route: '/agent/record:error-test?tab=multiple' });
    const start = await screen.findByRole('button', { name: 'Start' });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.setup().click(start);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('keeps single-call failures visible in the result panel and clears them after a successful retry', async () => {
    vi.mocked(submitCompletion).mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce({
      id: 'test', model: 'example', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Retry succeeded' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    localStorage.setItem('ai-test-agent:last-model', 'example');
    renderWithProviders(<RecordPage />);
    const submit = screen.getByRole('button', { name: 'Submit' });
    await waitFor(() => expect(submit).toBeEnabled());
    const user = userEvent.setup();
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('Submit to see a result')).not.toBeInTheDocument();
    await user.click(submit);
    expect(await screen.findByText('Retry succeeded')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(cases)('shows failed requests in $name results', async ({ Page, key, draft }) => {
    for (const submit of [submitDecision, submitExtraction, submitImageGeneration]) vi.mocked(submit).mockRejectedValue(new Error(message));
    localStorage.setItem(`ai-test-agent:${key}-draft`, JSON.stringify({ name: 'Ready', ...draft, tasks: [{ ...task, model: 'example' }], callCount: 1 }));
    renderWithProviders(<Page />);
    const start = screen.getByRole('button', { name: 'Start' });
    await waitFor(() => expect(start).toBeEnabled());
    await userEvent.setup().click(start);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
