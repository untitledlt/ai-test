import { describe, expect, it } from 'vitest';
import { createExtractTask, DEFAULT_EXTRACTION_SCHEMA } from './extract-utils';

// OpenAI's Structured Outputs strict mode (which submitExtraction always requests) rejects any
// schema where an object doesn't list every one of its properties as required, or doesn't set
// additionalProperties: false — at every nesting level, including objects inside arrays.
// https://platform.openai.com/docs/guides/structured-outputs
function assertStrictModeCompliant(schema: unknown, path = 'root') {
  if (typeof schema !== 'object' || schema === null) return;
  const node = schema as Record<string, unknown>;
  if (node.type === 'object' && node.properties) {
    expect(node.additionalProperties, `${path}.additionalProperties`).toBe(false);
    const propertyNames = Object.keys(node.properties as Record<string, unknown>);
    expect(node.required, `${path}.required`).toEqual(propertyNames);
    for (const [name, value] of Object.entries(node.properties as Record<string, unknown>)) {
      assertStrictModeCompliant(value, `${path}.properties.${name}`);
    }
  }
  if (node.type === 'array' && node.items) {
    assertStrictModeCompliant(node.items, `${path}.items`);
  }
}

describe('createExtractTask', () => {
  it('creates a blank task with no model and not excluded', () => {
    const task = createExtractTask();
    expect(task).toEqual({ id: expect.any(String), model: '', excluded: false });
  });

  it('gives each task a unique id', () => {
    const a = createExtractTask();
    const b = createExtractTask();
    expect(a.id).not.toBe(b.id);
  });
});

describe('DEFAULT_EXTRACTION_SCHEMA', () => {
  it('is valid JSON', () => {
    expect(() => JSON.parse(DEFAULT_EXTRACTION_SCHEMA)).not.toThrow();
  });

  it('satisfies OpenAI structured-outputs strict mode at every nesting level', () => {
    const schema = JSON.parse(DEFAULT_EXTRACTION_SCHEMA);
    assertStrictModeCompliant(schema);
  });
});
