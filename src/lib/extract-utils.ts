import { randomUUID } from './uuid';

export type ExtractTask = { id: string; model: string; excluded?: boolean };

export function createExtractTask(): ExtractTask {
  return { id: randomUUID(), model: '', excluded: false };
}

// OpenAI's Structured Outputs strict mode (always requested by submitExtraction) rejects a schema
// unless every object lists ALL of its properties in `required` and sets
// `additionalProperties: false` — at every nesting level, including objects inside arrays.
// Fields that are genuinely optional on a receipt are modeled as nullable rather than omitted.
// https://platform.openai.com/docs/guides/structured-outputs
export const DEFAULT_EXTRACTION_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      merchant: { type: 'string', description: 'Name of the merchant/business' },
      date: { type: ['string', 'null'], description: 'Transaction date, ISO 8601 (YYYY-MM-DD)' },
      currency: { type: ['string', 'null'], description: 'ISO 4217 currency code, e.g. USD' },
      subtotal: { type: ['number', 'null'] },
      tax: { type: ['number', 'null'] },
      total: { type: 'number' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: ['number', 'null'] },
            unitPrice: { type: ['number', 'null'] },
            totalPrice: { type: 'number' },
          },
          required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
          additionalProperties: false,
        },
      },
    },
    required: ['merchant', 'date', 'currency', 'subtotal', 'tax', 'total', 'items'],
    additionalProperties: false,
  },
  null,
  2,
);
