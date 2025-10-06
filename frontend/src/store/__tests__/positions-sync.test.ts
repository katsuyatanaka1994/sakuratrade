import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyPositionsSnapshot,
  clearAllPositions,
  getState,
  makePositionKey,
  syncPositionsBatch,
  type Position,
} from '../positions';

const basePosition = (overrides: Partial<Position>): Position => ({
  symbol: '7203',
  side: 'LONG' as const,
  qtyTotal: 100,
  avgPrice: 1000,
  lots: [
    {
      price: 1000,
      qtyRemaining: 100,
      time: '2024-01-01T00:00:00Z',
    },
  ],
  realizedPnl: 0,
  updatedAt: '2024-01-01T00:00:00Z',
  status: 'OPEN' as const,
  version: 1,
  ...overrides,
});

describe('positions snapshot and sync', () => {
  beforeEach(() => {
    clearAllPositions();
  });

  it('filters closed or empty positions when applying a snapshot', () => {
    applyPositionsSnapshot([
      basePosition({ symbol: '7203', side: 'LONG', qtyTotal: 100, status: 'OPEN' }),
      basePosition({ symbol: '7203', side: 'SHORT', qtyTotal: 0, status: 'OPEN' }),
      basePosition({ symbol: '6758', side: 'LONG', qtyTotal: 50, status: 'CLOSED' }),
    ]);

    const state = getState();
    expect(state.positions.size).toBe(1);
    const key = makePositionKey('7203', 'LONG', undefined);
    expect(state.positions.get(key)?.qtyTotal).toBe(100);
  });

  it('updates and removes positions with batched sync calls', () => {
    applyPositionsSnapshot([
      basePosition({ symbol: '7203', side: 'LONG', qtyTotal: 100, status: 'OPEN', chatId: 'chat-1' }),
    ]);

    const key = makePositionKey('7203', 'LONG', 'chat-1');

    syncPositionsBatch([
      basePosition({ symbol: '7203', side: 'LONG', qtyTotal: 80, status: 'OPEN', chatId: 'chat-1', updatedAt: '2024-01-02T00:00:00Z' }),
    ]);

    let state = getState();
    expect(state.positions.get(key)?.qtyTotal).toBe(80);
    expect(state.positions.get(key)?.updatedAt).toBe('2024-01-02T00:00:00Z');

    syncPositionsBatch([
      basePosition({ symbol: '7203', side: 'LONG', qtyTotal: 0, status: 'OPEN', chatId: 'chat-1', updatedAt: '2024-01-03T00:00:00Z' }),
    ]);

    state = getState();
    expect(state.positions.has(key)).toBe(false);
  });
});
