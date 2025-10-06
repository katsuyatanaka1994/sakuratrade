import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePositionsLive } from '../usePositionsLive';
import * as positionsStore from '../../store/positions';
import * as api from '../../lib/api/positions';
import { makePositionKey } from '../../store/positions';

const createPositionPayload = (overrides: Partial<positionsStore.Position> = {}): positionsStore.Position => ({
  symbol: '7203',
  side: 'LONG',
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
  status: 'OPEN',
  version: 1,
  chatId: 'chat-1',
  ...overrides,
});

describe('usePositionsLive (fallback mode)', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let pendingFrame: ((time: number) => void) | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    pendingFrame = null;
    globalThis.requestAnimationFrame = ((cb: any) => {
      pendingFrame = cb;
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as typeof globalThis & { requestAnimationFrame?: typeof globalThis.requestAnimationFrame }).requestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete (globalThis as typeof globalThis & { cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame }).cancelAnimationFrame;
    }
  });

  it('batches multiple upsert events for the same position within a frame', () => {
    const syncSpy = vi.spyOn(positionsStore, 'syncPositionsBatch').mockImplementation(() => {});
    vi.spyOn(positionsStore, 'removePositionsByKeys').mockImplementation(() => {});
    vi.spyOn(positionsStore, 'applyPositionsSnapshot').mockImplementation(() => {});
    vi.spyOn(api, 'fetchPositionsList').mockResolvedValue([]);

    renderHook(() => usePositionsLive({ autoConnect: false }));

    act(() => {
      window.dispatchEvent(new CustomEvent('positions.live', {
        detail: {
          type: 'positions.upsert',
          payload: createPositionPayload({ qtyTotal: 100 }),
        },
      }));
      window.dispatchEvent(new CustomEvent('positions.live', {
        detail: {
          type: 'positions.upsert',
          payload: createPositionPayload({ qtyTotal: 140, updatedAt: '2024-01-02T00:00:00Z' }),
        },
      }));
      pendingFrame?.(0);
      pendingFrame = null;
    });

    expect(syncSpy).toHaveBeenCalledTimes(1);
    const batched = syncSpy.mock.calls[0][0];
    expect(batched).toHaveLength(1);
    expect(batched[0].qtyTotal).toBe(140);
    expect(batched[0].updatedAt).toBe('2024-01-02T00:00:00Z');
  });

  it('queues removals and resolves them to position keys', () => {
    vi.spyOn(positionsStore, 'syncPositionsBatch').mockImplementation(() => {});
    const removeSpy = vi.spyOn(positionsStore, 'removePositionsByKeys').mockImplementation(() => {});
    vi.spyOn(positionsStore, 'applyPositionsSnapshot').mockImplementation(() => {});
    vi.spyOn(api, 'fetchPositionsList').mockResolvedValue([]);

    renderHook(() => usePositionsLive({ autoConnect: false }));

    act(() => {
      window.dispatchEvent(new CustomEvent('positions.live', {
        detail: {
          type: 'positions.removed',
          payload: { symbol: '7203', side: 'LONG', chatId: 'chat-1' },
        },
      }));
      pendingFrame?.(0);
      pendingFrame = null;
    });

    expect(removeSpy).toHaveBeenCalledTimes(1);
    const keys = removeSpy.mock.calls[0][0];
    expect(keys).toEqual([makePositionKey('7203', 'LONG', 'chat-1')]);
  });

  it('fetches a snapshot when requested', async () => {
    vi.spyOn(positionsStore, 'syncPositionsBatch').mockImplementation(() => {});
    vi.spyOn(positionsStore, 'removePositionsByKeys').mockImplementation(() => {});
    const snapshotSpy = vi.spyOn(positionsStore, 'applyPositionsSnapshot').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(api, 'fetchPositionsList').mockResolvedValue([
      createPositionPayload({ qtyTotal: 90 }),
    ]);

    renderHook(() => usePositionsLive({ autoConnect: false }));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('positions.live', {
        detail: { type: 'positions.snapshot.request' },
      }));
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(snapshotSpy).toHaveBeenCalledWith([
      expect.objectContaining({ symbol: '7203', qtyTotal: 90 }),
    ]);
  });
});
