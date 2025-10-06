import { describe, it, expect } from 'vitest';
import { normaliseServerPosition, ALLOWED_POSITION_SOURCES } from '../api/positions';

const basePayload = {
  symbol: '7203',
  side: 'LONG',
  qtyTotal: 100,
  avgPrice: 1000,
  positionId: 'pos-123',
  lots: [
    {
      price: 1000,
      qtyRemaining: 100,
      time: '2024-01-01T00:00:00Z',
    },
  ],
  realizedPnl: 0,
  updatedAt: '2024-01-01T00:00:00Z',
  version: 1,
  status: 'OPEN',
  chatId: 'chat-1',
};

describe('normaliseServerPosition', () => {
  it('accepts modal sources and normalises numeric strings', () => {
    const payload = {
      ...basePayload,
      qtyTotal: undefined,
      qty: '120',
      avgPrice: undefined,
      avg_price: '1500',
      source: Array.from(ALLOWED_POSITION_SOURCES)[0],
    };

    const position = normaliseServerPosition(payload);
    expect(position).not.toBeNull();
    expect(position?.qtyTotal).toBe(120);
    expect(position?.avgPrice).toBe(1500);
  });

  it('filters out non-modal sources', () => {
    const payload = {
      ...basePayload,
      source: 'api.bulk',
    };

    const position = normaliseServerPosition(payload);
    expect(position).toBeNull();
  });

  it('filters out positions without chatId', () => {
    const payload = {
      ...basePayload,
      chatId: undefined,
      chat_id: undefined,
    } as const;

    const position = normaliseServerPosition(payload as typeof basePayload);
    expect(position).toBeNull();
  });

  it('filters out positions without positionId', () => {
    const { positionId, ...rest } = basePayload;
    const payload = {
      ...rest,
      positionId: undefined,
      position_id: undefined,
    } as const;

    const position = normaliseServerPosition(payload as typeof basePayload);
    expect(position).toBeNull();
  });
});
