import { isDemoMode } from './onboarding';

export const DEMO_MAX_OUTPUT_TOKENS = 2048;

/** Enforce at the request boundary too, including blank fields and loaded records. */
export function capDemoMaxTokens(serverURL: string, requested?: number): number | undefined {
  if (!isDemoMode({ serverURL })) return requested;
  if (requested === undefined || !Number.isFinite(requested)) return DEMO_MAX_OUTPUT_TOKENS;
  return Math.min(DEMO_MAX_OUTPUT_TOKENS, Math.max(1, Math.round(requested)));
}

export const DEMO_MAX_TASKS = 5;
export const DEMO_MAX_CALLS = 2;
export const DEMO_TEXT_BYTES = 64 * 1024;
export const DEMO_PAYLOAD_BYTES = 5 * 1024 * 1024;
export const WARN_TEXT_BYTES = 32 * 1024;
export const WARN_PAYLOAD_BYTES = 2 * 1024 * 1024;

export type RunSize = {
  taskCount: number;
  activeTaskCount: number;
  callCount: number;
  payloads: unknown[];
};

/** Measure each request, not saved history or credentials. Embedded images count toward
 * total bytes, but not the text budget; JSON structure and schemas count as text. */
export function measurePayload(payload: unknown) {
  const encode = (value: string) => new TextEncoder().encode(value).byteLength;
  return {
    total: encode(JSON.stringify(payload)),
    text: encode(JSON.stringify(payload, (_key, value: unknown) =>
      typeof value === 'string' && /^data:image\//i.test(value) ? '' : value)),
  };
}

export function checkRunLimits(demo: boolean, run: RunSize): { blocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!Number.isInteger(run.callCount) || run.callCount < 1 || run.callCount > 20) {
    return { blocked: true, reasons: ['Calls per model must be a whole number from 1 to 20.'] };
  }
  if (demo && run.taskCount > DEMO_MAX_TASKS) reasons.push('Demo allows at most 5 tasks. Remove extra tasks before running.');
  if (demo && run.callCount > DEMO_MAX_CALLS) reasons.push('Demo allows at most 2 calls per model.');
  if (!demo && run.activeTaskCount > 5) reasons.push(`${run.activeTaskCount} model tasks will run.`);
  if (!demo && run.callCount > 5) reasons.push(`${run.callCount} calls will run per model.`);
  const sizes = run.payloads.map(measurePayload);
  if (sizes.some((size) => size.text > (demo ? DEMO_TEXT_BYTES : WARN_TEXT_BYTES))) {
    reasons.push(demo ? 'Demo text/JSON payloads are limited to 64 KiB per request.' : 'A request contains more than 32 KiB of text/JSON.');
  }
  if (sizes.some((size) => size.total > (demo ? DEMO_PAYLOAD_BYTES : WARN_PAYLOAD_BYTES))) {
    reasons.push(demo ? 'Demo payloads including encoded images are limited to 5 MiB per request.' : 'A request exceeds 2 MiB including encoded images.');
  }
  return { blocked: demo && reasons.length > 0, reasons };
}
