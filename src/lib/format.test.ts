import { describe, expect, it } from 'vitest';
import {
  formatCost,
  formatDateTime,
  formatDuration,
  formatImageModelPrice,
  formatTokens,
  formatVisionModelPrice,
  maskApiKey,
} from './format';

describe('formatTokens', () => {
  it('adds thousands separators', () => {
    expect(formatTokens(1234567)).toBe('1,234,567');
  });

  it('rounds fractional values', () => {
    expect(formatTokens(12.6)).toBe('13');
  });
});

describe('formatCost', () => {
  it('formats a cost with 6 decimal places', () => {
    expect(formatCost(0.0001234)).toBe('$0.000123');
  });

  it('returns an em dash for null or undefined', () => {
    expect(formatCost(null)).toBe('—');
    expect(formatCost(undefined)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('formats sub-second durations in ms', () => {
    expect(formatDuration(250)).toBe('250ms');
  });

  it('formats durations at or above 1s in seconds with 2 decimals', () => {
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(12340)).toBe('12.34s');
  });
});

describe('formatDateTime', () => {
  it('formats an ISO string as YYYY-MM-DD HH:mm', () => {
    const iso = new Date(2024, 2, 5, 9, 7).toISOString();
    expect(formatDateTime(iso)).toBe('2024-03-05 09:07');
  });
});

describe('formatImageModelPrice', () => {
  it('formats a per-image price as "from $X/image"', () => {
    expect(formatImageModelPrice({ costUsd: 0.0184, unit: 'image' })).toBe('from $0.0184/image');
  });

  it('abbreviates the megapixel unit to MP', () => {
    expect(formatImageModelPrice({ costUsd: 0.1, unit: 'megapixel' })).toBe('from $0.1000/MP');
  });

  it('uses more decimal places for sub-millicent per-token prices so they are not rounded to zero', () => {
    expect(formatImageModelPrice({ costUsd: 0.00003, unit: 'token' })).toBe('from $0.000030/token');
  });

  it('returns null when there is no price', () => {
    expect(formatImageModelPrice(undefined)).toBeNull();
  });
});

describe('formatVisionModelPrice', () => {
  it('formats prompt/completion per-token prices as $/1M tokens', () => {
    expect(formatVisionModelPrice({ promptPrice: 0.000002, completionPrice: 0.00001 })).toBe(
      'in $2.00 · out $10.00 /1M tok',
    );
  });

  it('shows $0.00 for free models', () => {
    expect(formatVisionModelPrice({ promptPrice: 0, completionPrice: 0 })).toBe('in $0.00 · out $0.00 /1M tok');
  });
});

describe('maskApiKey', () => {
  it('returns an empty string for an empty key', () => {
    expect(maskApiKey('')).toBe('');
  });

  it('fully masks short keys', () => {
    expect(maskApiKey('short')).toBe('•••••');
  });

  it('shows first 4 and last 4 characters for longer keys', () => {
    expect(maskApiKey('sk-or-v1-abcdef1234')).toBe('sk-o••••1234');
  });
});
