import { describe, it, expect } from 'vitest';
import { validateSettle, formatLSHeader } from '@/lib/validation';

describe('validateSettle', () => {
  it('ok', () => {
    const r = validateSettle('8100', '100', 100);
    expect(r.ok).toBe(true);
    // @ts-expect-error runtime shape
    expect(r.price).toBe(8100);
    // @ts-expect-error runtime shape
    expect(r.qty).toBe(100);
  });
  it('price <= 0', () => {
    const r = validateSettle('0', '10', 100);
    expect(r.ok).toBe(false);
    // @ts-expect-error runtime shape
    expect(r.error).toContain('価格は0より大きい');
  });
  it('qty not integer', () => {
    const r = validateSettle('8100', '0.5', 100);
    expect(r.ok).toBe(false);
    // @ts-expect-error runtime shape
    expect(r.error).toContain('数量は1以上の整数');
  });
  it('qty exceed', () => {
    const r = validateSettle('8100', '101', 100);
    expect(r.ok).toBe(false);
    // @ts-expect-error runtime shape
    expect(r.error).toContain('保有');
  });
});

describe('formatLSHeader', () => {
  it('both', () => expect(formatLSHeader(140, 100)).toBe('L:ロング / S:ショート'));
  it('long only', () => expect(formatLSHeader(200, 0)).toBe('L:ロング'));
  it('short only', () => expect(formatLSHeader(0, 50)).toBe('S:ショート'));
  it('zero guard', () => expect(formatLSHeader(0, 0)).toBe('L:ロング / S:ショート'));
});