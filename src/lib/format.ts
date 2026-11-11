const tokenFormatter = new Intl.NumberFormat('en-US');

export function formatTokens(value: number): string {
  return tokenFormatter.format(Math.round(value));
}

export function formatCost(cost: number | undefined | null): string {
  if (cost == null) return '—';
  return `$${cost.toFixed(6)}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatImageModelPrice(price: { costUsd: number; unit: string } | undefined): string | null {
  if (!price) return null;
  const unitLabel = price.unit === 'megapixel' ? 'MP' : price.unit;
  const decimals = price.costUsd < 0.001 ? 6 : 4;
  return `from $${price.costUsd.toFixed(decimals)}/${unitLabel}`;
}

export function formatVisionModelPrice(price: { promptPrice: number; completionPrice: number }): string {
  const perMillion = (price: number) => Number.isFinite(price) ? `$${(price * 1_000_000).toFixed(2)}` : 'unknown';
  return `in ${perMillion(price.promptPrice)} · out ${perMillion(price.completionPrice)} /1M tok`;
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(4)}${key.slice(-4)}`;
}
