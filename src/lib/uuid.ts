/**
 * `crypto.randomUUID()` only works in secure contexts (HTTPS or localhost) — it's
 * undefined when the app is loaded over plain http from a LAN IP (e.g. a phone
 * reaching the dev server at http://10.0.1.x:5174). `crypto.getRandomValues()` has
 * no such restriction, so it's used as the fallback, building a standard v4 UUID.
 */
export function randomUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
