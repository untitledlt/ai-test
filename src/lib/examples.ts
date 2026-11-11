import { db, putDoc } from '../db/client';
import type { AgentRecord, DecisionRecord, ExtractRecord, ImageGenRecord } from '../db/types';
import { randomUUID } from './uuid';
import { PRISON_RECORD_CONTENT } from './seed-data';
import { DEFAULT_EXTRACTION_SCHEMA } from './extract-utils';
import { receiptImage, contactImage, productImage } from './example-assets';

type ExampleRecord = AgentRecord | DecisionRecord | ExtractRecord | ImageGenRecord;
export type ToolPath = '/agent' | '/decision' | '/image' | '/extract';
export type Example = {
  id: string;
  version: number;
  tool: ToolPath;
  title: string;
  description: string;
  capability: string;
  type: ExampleRecord['type'];
  content: string;
};
const ticket =
  'A fictional customer reports that checkout shows a blank screen after clicking Pay. Two browsers were tried.';
const task = { model: '', excluded: false };
export const EXAMPLES: Example[] = [
  {
    id: 'ticket-summary',
    version: 1,
    tool: '/agent',
    type: 'record',
    title: 'Summarize a support ticket',
    description: 'Ask for a concise summary of a fictional ticket.',
    capability: 'Text output',
    content: JSON.stringify({ messages: [{ role: 'user', content: `Summarize in two sentences: ${ticket}` }] }),
  },
  {
    id: 'function-call',
    version: 1,
    tool: '/agent',
    type: 'record',
    title: 'Function-call request',
    description: 'Inspect get_weather arguments; no weather service is executed.',
    capability: 'Function tools',
    content: JSON.stringify({
      messages: [{ role: 'user', content: 'What is the weather in Vilnius? Use the available function.' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Look up weather for a city.',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
              additionalProperties: false,
            },
          },
        },
      ],
    }),
  },
  {
    id: 'prison',
    version: 1,
    tool: '/agent',
    type: 'record',
    title: 'Prison prompt-injection test',
    description: 'Test the existing fictional PIN and function-call scenario.',
    capability: 'Function tools',
    content: PRISON_RECORD_CONTENT,
  },
  {
    id: 'ticket-triage',
    version: 1,
    tool: '/decision',
    type: 'decision',
    title: 'Triage a support ticket',
    description: 'Compare yes/no, team choice and urgency scoring.',
    capability: 'Decisions API',
    content: JSON.stringify({
      state: [ticket],
      questions: {
        is_bug: {
          type: 'noul',
          instructions: 'Is this a bug?',
          criteria: { true: 'Broken behavior', false: 'Question or feature request' },
        },
        team: {
          type: 'choice',
          instructions: 'Which team owns it?',
          criteria: { frontend: 'Rendering problems', payments: 'Billing problems' },
        },
        urgency: {
          type: 'score',
          instructions: 'How urgent?',
          criteria: ['Can wait', 'Fix this week', 'Blocking checkout'],
        },
      },
      tasks: [task],
      callCount: 1,
    }),
  },
  {
    id: 'product-photo',
    version: 1,
    tool: '/image',
    type: 'image-gen',
    title: 'Product studio photo',
    description: 'Generate a fictional blue travel mug on a plain background.',
    capability: 'Image output',
    content: JSON.stringify({
      prompt: 'Studio photo of a fictional blue travel mug, plain cream background, soft lighting, no text.',
      inputImages: [],
      tasks: [{ ...task, resolution: '1K', aspectRatio: '1:1' }],
      callCount: 1,
    }),
  },
  {
    id: 'reference-restyle',
    version: 1,
    tool: '/image',
    type: 'image-gen',
    title: 'Restyle a reference image',
    description: 'Transform a bundled synthetic product illustration.',
    capability: 'Image input and output',
    content: JSON.stringify({
      prompt: 'Restyle the reference mug as a watercolor illustration.',
      inputImages: [{ dataUrl: productImage, fileName: 'fictional-mug.png' }],
      tasks: [{ ...task, resolution: '1K', aspectRatio: '1:1' }],
      callCount: 1,
    }),
  },
  {
    id: 'receipt',
    version: 1,
    tool: '/extract',
    type: 'extract',
    title: 'Extract a receipt',
    description: 'Extract totals and items from a synthetic cafe receipt.',
    capability: 'Vision and JSON Schema',
    content: JSON.stringify({
      instructions: 'Extract the fictional receipt according to the schema. Use null for missing values.',
      schema: DEFAULT_EXTRACTION_SCHEMA,
      inputImages: [{ dataUrl: receiptImage, fileName: 'fictional-receipt.png' }],
      tasks: [task],
      callCount: 1,
    }),
  },
  {
    id: 'contact-card',
    version: 1,
    tool: '/extract',
    type: 'extract',
    title: 'Extract a contact card',
    description: 'Extract fictional contact details into structured JSON.',
    capability: 'Vision and JSON Schema',
    content: JSON.stringify({
      instructions: 'Extract the fictional contact card fields.',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
          company: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
        },
        required: ['name', 'company', 'email', 'phone'],
        additionalProperties: false,
      }),
      inputImages: [{ dataUrl: contactImage, fileName: 'fictional-contact.png' }],
      tasks: [task],
      callCount: 1,
    }),
  },
];
function record(example: Example, id: string, name: string): ExampleRecord {
  const now = new Date().toISOString();
  const base = { _id: id, type: example.type, name, content: example.content, createdAt: now, updatedAt: now };
  return (
    example.type === 'record'
      ? { ...base, multipleTasks: [{ id: randomUUID(), ...task, maxTokens: 2048 }], multipleCallCount: 1 }
      : base
  ) as ExampleRecord;
}
function conflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
}
/** Deterministic record IDs, local markers and tombstone checks protect edits and deletions. */
export async function seedExamples() {
  for (const example of EXAMPLES) {
    const marker = `_local/example-seed:${example.id}`;
    try {
      await db.get(marker);
      continue;
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'status' in error && error.status === 404)) throw error;
    }
    const id = `${example.type}:example-${example.id}`;
    const existing = await db.allDocs({ keys: [id] });
    // A tombstone is intentionally kept deleted. Existing seed records are never overwritten.
    if ('error' in existing.rows[0]) {
      try {
        await putDoc(record(example, id, `Example: ${example.title}`));
      } catch (error) {
        if (!conflict(error)) throw error;
      }
    }
    try {
      await db.put({ _id: marker, version: example.version });
    } catch (error) {
      if (!conflict(error)) throw error;
    }
  }
}
/** Loading is local, does not change providers and never performs generation. */
export async function loadExample(example: Example): Promise<string> {
  const id = `${example.type}:${randomUUID()}`;
  await putDoc(record(example, id, example.title));
  // Empty model forces an explicit compatible choice instead of inheriting an
  // unrestricted model from a previous provider. Preserve unrelated draft storage.
  if (example.type === 'record') {
    try {
      localStorage.setItem('ai-test-agent:last-model', '');
    } catch {
      /* The saved copy remains loadable if preferences are unavailable. */
    }
  }
  return `${example.tool}/${encodeURIComponent(id)}`;
}
