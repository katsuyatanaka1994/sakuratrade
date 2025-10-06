import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const POSITIONS_KEY = 'positions_data';
const CLOSED_KEY = 'closed_positions_data';

const createPersistedPosition = (overrides: Partial<Record<string, unknown>> = {}) => ({
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

describe('positions store migration', () => {
  const originalLocalStorage = global.localStorage;
  let getItemSpy: ReturnType<typeof vi.fn>;
  let setItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();

    const persistedPositions = JSON.stringify([
      ['7203:LONG:default', createPersistedPosition({ chatId: null, positionId: undefined })],
      ['6758:LONG:chat-1', createPersistedPosition({ symbol: '6758', chatId: 'chat-1', positionId: 'pos-2' })],
    ]);

    const persistedClosed = JSON.stringify([
      createPersistedPosition({ chatId: null, positionId: 'pos-3' }),
      createPersistedPosition({ symbol: '6758', chatId: 'chat-1', positionId: 'pos-4' }),
    ]);

    getItemSpy = vi.fn((key: string) => {
      if (key === POSITIONS_KEY) return persistedPositions;
      if (key === CLOSED_KEY) return persistedClosed;
      return null;
    });

    setItemSpy = vi.fn();

    global.localStorage = {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    vi.resetModules();
  });

  it('purges persisted positions without chatId during bootstrap', async () => {
    const { getState } = await import('../../store/positions');
    const state = getState();

    expect(state.positions.size).toBe(1);
    expect(Array.from(state.positions.keys())).toEqual(['6758:LONG:chat-1']);
    expect(setItemSpy).toHaveBeenCalledWith(
      POSITIONS_KEY,
      expect.not.stringContaining('7203:LONG:default'),
    );

    expect(state.closed).toHaveLength(1);
    expect(state.closed[0].chatId).toBe('chat-1');
    expect(setItemSpy).toHaveBeenCalledWith(
      CLOSED_KEY,
      expect.not.stringContaining('"chatId":null'),
    );
  });
});
