import { vi } from 'vitest';

export type Side = 'LONG' | 'SHORT';

export interface TradeSnapshot {
  tradeId: string;
  chatId: string;
  symbol: string;
  side: Side;
  avgEntry: number;
  avgExit: number;
  qty: number;
  pnlAbs: number;
  pnlPct: number;
  holdMinutes: number;
  closedAt: string;
  feedback?: {
    text: string;
    tone: 'praise' | 'advice';
    nextActions: string[];
    messageId?: string;
  };
  analysis?: {
    score: number;
    labels: string[];
  };
}

export interface Lot {
  price: number;
  qtyRemaining: number;
  time: string;
}

export interface Position {
  symbol: string;
  side: Side;
  qtyTotal: number;
  avgPrice: number;
  lots: Lot[];
  realizedPnl: number;
  updatedAt: string;
  name?: string;
  chatId?: string;
  currentTradeId?: string;
  status?: 'OPEN' | 'CLOSED';
  ownerId?: string;
  version: number;
  chartImageId?: string | null;
  aiFeedbacked?: boolean;
}

export interface SymbolGroup {
  symbol: string;
  name?: string;
  positions: Position[];
}

export interface SettlementRecordLot {
  lotPrice: number;
  qty: number;
}

export interface SettlementRecord {
  symbol: string;
  side: Side;
  qty: number;
  exitPrice: number;
  lots: SettlementRecordLot[];
  pnl: number;
  pnlPct: number;
  createdAt: string;
  tradeId?: string;
  aiFeedbackId?: string;
  imageId?: string | null;
  undone?: boolean;
}

interface PositionsState {
  positions: Map<string, Position>;
  closed: Position[];
  settlementHistory: Record<string, SettlementRecord>;
  failedJournalQueue: Array<{ tradeSnapshot: TradeSnapshot; timestamp: string; retryCount: number }>;
  tradeEntries: Map<string, string>;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener failures in tests
    }
  });
};

const state: PositionsState = {
  positions: new Map<string, Position>(),
  closed: [],
  settlementHistory: {},
  failedJournalQueue: [],
  tradeEntries: new Map<string, string>(),
};

export const subscribe = vi.fn((listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
});

export const makePositionKey = (symbol: string, side: Side, chatId?: string | null) =>
  `${symbol}:${side}:${chatId ?? 'default'}`;

const buildPosition = (
  symbol: string,
  side: Side,
  price: number,
  qty: number,
  name?: string,
  chatId?: string,
): Position => ({
  symbol,
  side,
  qtyTotal: qty,
  avgPrice: price,
  lots: [
    {
      price,
      qtyRemaining: qty,
      time: new Date().toISOString(),
    },
  ],
  realizedPnl: 0,
  updatedAt: new Date().toISOString(),
  name,
  chatId,
  version: 1,
});

export const getState = () => state;

export const entry = vi.fn(
  (symbol: string, side: Side, price: number, qty: number, name?: string, chatId?: string) => {
    const key = makePositionKey(symbol, side, chatId);
    const position = buildPosition(symbol, side, price, qty, name, chatId);
    state.positions.set(key, position);
    notifyListeners();
    return position;
  },
);

export const removeEntryLot = vi.fn(
  (symbol: string, side: Side, price: number, qty: number, chatId?: string) => {
    const key = makePositionKey(symbol, side, chatId);
    const position = state.positions.get(key);
    if (!position) {
      return false;
    }
    position.qtyTotal = Math.max(0, position.qtyTotal - qty);
    position.avgPrice = price;
    position.updatedAt = new Date().toISOString();
    notifyListeners();
    return true;
  },
);

export const updatePosition = vi.fn(
  (symbol: string, side: Side, updates: Partial<Position>, chatId?: string) => {
    const key = makePositionKey(symbol, side, chatId);
    const position = state.positions.get(key);
    if (!position) {
      return null;
    }
    const next = { ...position, ...updates, updatedAt: new Date().toISOString() };
    state.positions.set(key, next);
    notifyListeners();
    return next;
  },
);

export const syncPositionFromServer = vi.fn((position: Position) => {
  const key = makePositionKey(position.symbol, position.side, position.chatId);
  state.positions.set(key, { ...position });
  notifyListeners();
  return position;
});

export const settle = vi.fn(
  (symbol: string, side: Side, price: number, qty: number, chatId?: string) => {
    const key = makePositionKey(symbol, side, chatId);
    const position = state.positions.get(key);
    if (position) {
      position.qtyTotal = Math.max(0, position.qtyTotal - qty);
      position.updatedAt = new Date().toISOString();
      if (position.qtyTotal === 0) {
        state.positions.delete(key);
        state.closed.push({ ...position, status: 'CLOSED' });
      }
    }
    notifyListeners();
    return {
      tradeSnapshot: position
        ? {
            tradeId: position.currentTradeId ?? `trade-${Date.now()}`,
            chatId: position.chatId ?? chatId ?? 'default',
            symbol: position.symbol,
            side: position.side,
            avgEntry: position.avgPrice,
            avgExit: price,
            qty,
            pnlAbs: (price - position.avgPrice) * qty,
            pnlPct: position.avgPrice ? ((price - position.avgPrice) / position.avgPrice) * 100 : 0,
            holdMinutes: 0,
            closedAt: new Date().toISOString(),
          }
        : null,
    };
  },
);

export const recordSettlement = vi.fn(
  (exitMessageId: string, record: Omit<SettlementRecord, 'createdAt' | 'undone'>) => {
    state.settlementHistory[exitMessageId] = {
      ...record,
      createdAt: new Date().toISOString(),
    };
    notifyListeners();
  },
);

export const unsettle = vi.fn((exitMessageId: string) => {
  const existing = state.settlementHistory[exitMessageId];
  if (!existing) {
    return false;
  }
  existing.undone = true;
  notifyListeners();
  return true;
});

export const getGroups = vi.fn((chatId?: string) => {
  const groups = new Map<string, SymbolGroup>();
  for (const position of state.positions.values()) {
    if (chatId && position.chatId !== chatId) {
      continue;
    }
    const group = groups.get(position.symbol) ?? {
      symbol: position.symbol,
      name: position.name,
      positions: [],
    };
    group.positions.push({ ...position });
    groups.set(position.symbol, group);
  }
  return Array.from(groups.values());
});

export const getLongShortQty = vi.fn((symbol: string, chatId?: string) => {
  let long = 0;
  let short = 0;
  for (const position of state.positions.values()) {
    if (position.symbol !== symbol) continue;
    if (chatId && position.chatId !== chatId) continue;
    if (position.side === 'LONG') {
      long += position.qtyTotal;
    } else {
      short += position.qtyTotal;
    }
  }
  return { long, short };
});

export const deletePosition = vi.fn((symbol: string, side: Side, chatId?: string) => {
  const key = makePositionKey(symbol, side, chatId);
  const existed = state.positions.delete(key);
  if (existed) {
    notifyListeners();
  }
  return existed;
});

export const clearAllPositions = vi.fn(() => {
  state.positions.clear();
  state.closed = [];
  state.settlementHistory = {};
  state.failedJournalQueue = [];
  state.tradeEntries.clear();
  notifyListeners();
});

export const debugPositions = vi.fn(() => ({
  positions: Array.from(state.positions.entries()),
  closed: [...state.closed],
  settlementHistory: { ...state.settlementHistory },
}));

export const submitJournalEntry = vi.fn(async (_snapshot: TradeSnapshot) => true);

export const retryFailedJournalEntries = vi.fn(async () => {
  state.failedJournalQueue = [];
});

export const __resetPositionsStub = () => {
  listeners.clear();
  state.positions.clear();
  state.closed = [];
  state.settlementHistory = {};
  state.failedJournalQueue = [];
  state.tradeEntries.clear();
  subscribe.mockReset();
  entry.mockReset();
  removeEntryLot.mockReset();
  updatePosition.mockReset();
  syncPositionFromServer.mockReset();
  settle.mockReset();
  recordSettlement.mockReset();
  unsettle.mockReset();
  getGroups.mockReset();
  getLongShortQty.mockReset();
  deletePosition.mockReset();
  clearAllPositions.mockReset();
  debugPositions.mockReset();
  submitJournalEntry.mockReset();
  retryFailedJournalEntries.mockReset();
};

export default {
  subscribe,
  makePositionKey,
  getState,
  entry,
  removeEntryLot,
  updatePosition,
  syncPositionFromServer,
  settle,
  recordSettlement,
  unsettle,
  getGroups,
  getLongShortQty,
  deletePosition,
  clearAllPositions,
  debugPositions,
  submitJournalEntry,
  retryFailedJournalEntries,
  __resetPositionsStub,
};
