import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { db } from '../db/client';

afterEach(async () => {
  // Stop mounted queries before removing their documents. Otherwise a provider
  // query can recreate app-settings while cleanup is still deleting it.
  cleanup();
  const result = await db.allDocs();
  await Promise.all(result.rows.map((row) => db.remove(row.id, row.value.rev)));
});

afterAll(async () => {
  await db.close();
});

// Radix UI primitives (Select, Popover, Dialog) rely on browser APIs jsdom doesn't implement.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!globalThis.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
// CodeMirror (used by @untitled/ui-kit's JsonEditor) measures text layout via Range.getClientRects,
// which jsdom doesn't implement; without this it throws asynchronously during editing and crashes the run.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
}
