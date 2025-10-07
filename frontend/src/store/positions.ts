import { isDevelopmentEnv, resolveApiBaseUrl } from '../lib/env';

// Using crypto.randomUUID() for cross-browser compatibility
// import * as ULID from 'ulid';

export type Side = 'LONG' | 'SHORT';

// Trade snapshot for journal
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
  chartPattern?: string;
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

// Failed journal entries queue for retry
interface FailedJournalEntry {
  tradeSnapshot: TradeSnapshot;
  timestamp: string;
  retryCount: number;
}

const FAILED_JOURNAL_QUEUE_KEY = 'failed_journal_queue';

export interface Lot { price: number; qtyRemaining: number; time: string }
export interface PositionNoteEntry { text: string; updatedAt?: string }
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
  positionId?: string;
  currentTradeId?: string; // ULID for trade journal tracking
  status?: 'OPEN' | 'CLOSED'; // Position status for edit permissions
  ownerId?: string; // Owner ID for edit permissions
  version: number; // Version for optimistic locking
  // Chart analysis linkage
  chartImageId?: string | null;
  aiFeedbacked?: boolean;
  note?: string;
  memo?: string;
  notes?: PositionNoteEntry[];
  chartPattern?: string;
  chartPatternLabel?: string;
  patterns?: string[];
}
export interface SymbolGroup { symbol: string; name?: string; positions: Position[] }

export interface PositionMetadata {
  note?: string;
  memo?: string;
  notes?: PositionNoteEntry[];
  chartPattern?: string;
  chartPatternLabel?: string;
  patterns?: string[];
}

const CLOSED_STATUS = new Set(['closed', 'CLOSED']);

function normaliseStatus(status?: string | null): 'OPEN' | 'CLOSED' {
  if (!status) return 'OPEN';
  return CLOSED_STATUS.has(status) ? 'CLOSED' : status.toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

function isClosed(status?: string | null): boolean {
  return normaliseStatus(status) === 'CLOSED';
}

function normaliseIncomingPosition(position: Position): Position {
  return {
    ...position,
    qtyTotal: Number.isFinite(position.qtyTotal) ? position.qtyTotal : Number(position.qtyTotal) || 0,
    avgPrice: Number.isFinite(position.avgPrice) ? position.avgPrice : Number(position.avgPrice) || 0,
    realizedPnl: Number.isFinite(position.realizedPnl) ? position.realizedPnl : Number(position.realizedPnl) || 0,
    updatedAt: position.updatedAt || new Date().toISOString(),
    status: normaliseStatus(position.status),
    version: Number.isFinite(position.version) ? position.version : 1,
  };
}

function applyMetadata(position: Position, metadata?: PositionMetadata) {
  if (!metadata) return;

  const appendNoteEntries = (value: unknown) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry) => {
      if (!entry) return;
      let candidate: PositionNoteEntry | null = null;
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) return;
        candidate = { text: trimmed };
      } else if (typeof entry === 'object' && typeof (entry as PositionNoteEntry).text === 'string') {
        const trimmed = (entry as PositionNoteEntry).text.trim();
        if (!trimmed) return;
        candidate = { text: trimmed, updatedAt: (entry as PositionNoteEntry).updatedAt };
      }
      if (!candidate) return;
      if (!position.notes) {
        position.notes = [candidate];
        return;
      }
      const exists = position.notes.some((note) => note.text === candidate!.text && note.updatedAt === candidate!.updatedAt);
      if (!exists) {
        position.notes.push(candidate);
      }
    });
  };

  if ('note' in metadata) {
    position.note = metadata.note;
    if (!('memo' in metadata)) {
      position.memo = metadata.note;
    }
    appendNoteEntries(metadata.note);
  }

  if ('memo' in metadata) {
    position.memo = metadata.memo;
    appendNoteEntries(metadata.memo);
  }

  if ('notes' in metadata) {
    appendNoteEntries(metadata.notes);
  }

  if ('chartPattern' in metadata) {
    position.chartPattern = metadata.chartPattern;
  }

  if ('chartPatternLabel' in metadata) {
    position.chartPatternLabel = metadata.chartPatternLabel;
  }

  if ('patterns' in metadata) {
    position.patterns = metadata.patterns;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let pendingNotify = false;
let batching = false;

function triggerNotify() {
  listeners.forEach(fn => fn()); 
  // Save to localStorage whenever state changes
  savePositionsToStorage();
}

function notify() {
  if (batching) {
    pendingNotify = true;
    return;
  }
  triggerNotify();
}

function runInBatch(fn: () => void) {
  batching = true;
  try {
    fn();
  } finally {
    batching = false;
    if (pendingNotify) {
      pendingNotify = false;
      triggerNotify();
    }
  }
}
export function subscribe(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

const ensureChatId = (chatId?: string | null) => {
  if (!chatId) {
    throw new Error('[positions.store] chatId is required for position operations');
  }
  return chatId;
};

export const makePositionKey = (symbol: string, side: Side, chatId: string) => `${symbol}:${side}:${chatId}`;

const key = (symbol: string, side: Side, chatId?: string | null) => makePositionKey(symbol, side, ensureChatId(chatId));

// localStorage keys for persistence
const POSITIONS_STORAGE_KEY = 'positions_data';
const CLOSED_POSITIONS_STORAGE_KEY = 'closed_positions_data';
const TRADE_ENTRIES_KEY = 'trade_entries'; // Track entry timestamps per tradeId
const SETTLEMENT_HISTORY_KEY = 'settlement_history'; // EXIT messageId -> settlement record

// Helper functions for localStorage serialization
function serializePositions(positions: Map<string, Position>): string {
  return JSON.stringify(Array.from(positions.entries()));
}

function deserializePositions(data: string): Map<string, Position> {
  try {
    const entries = JSON.parse(data);
    return new Map(entries);
  } catch (error) {
    console.warn('Failed to deserialize positions:', error);
    return new Map();
  }
}

function purgePositionsWithoutChatId(map: Map<string, Position>): number {
  let removed = 0;
  for (const [key, position] of map.entries()) {
    if (!position?.chatId) {
      map.delete(key);
      removed += 1;
    }
  }
  if (removed > 0) {
    console.warn(`[positions.store] Removed ${removed} position(s) without chatId from local storage`);
  }
  return removed;
}

function purgeClosedWithoutChatId(closed: Position[]): number {
  const originalLength = closed.length;
  const filtered = closed.filter(position => Boolean(position?.chatId));
  if (filtered.length !== originalLength) {
    const removed = originalLength - filtered.length;
    console.warn(`[positions.store] Removed ${removed} closed position(s) without chatId from local storage`);
    closed.length = 0;
    closed.push(...filtered);
    return removed;
  }
  return 0;
}

function savePositionsToStorage() {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY, serializePositions(state.positions));
    localStorage.setItem(CLOSED_POSITIONS_STORAGE_KEY, JSON.stringify(state.closed));
    saveTradeEntries();
    saveSettlementHistory();
    saveFailedJournalQueue();
  } catch (error) {
    console.warn('Failed to save positions to localStorage:', error);
    if (error.name === 'QuotaExceededError') {
      console.log('🧹 LocalStorage quota exceeded, clearing old data...');
      // Clear old data and retry
      clearOldData();
      try {
        localStorage.setItem(POSITIONS_STORAGE_KEY, serializePositions(state.positions));
        localStorage.setItem(CLOSED_POSITIONS_STORAGE_KEY, JSON.stringify(state.closed));
        saveTradeEntries();
        saveFailedJournalQueue();
        console.log('🧹 Successfully saved after cleanup');
      } catch (retryError) {
        console.error('🧹 Failed to save even after cleanup:', retryError);
      }
    }
  }
}

function loadPositionsFromStorage() {
  try {
    const positionsData = localStorage.getItem(POSITIONS_STORAGE_KEY);
    const closedData = localStorage.getItem(CLOSED_POSITIONS_STORAGE_KEY);
    const historyData = localStorage.getItem(SETTLEMENT_HISTORY_KEY);
    const positions = positionsData ? deserializePositions(positionsData) : new Map<string, Position>();
    const removedPositions = purgePositionsWithoutChatId(positions);
    if (removedPositions > 0) {
      try {
        localStorage.setItem(POSITIONS_STORAGE_KEY, serializePositions(positions));
      } catch (persistError) {
        console.warn('[positions.store] Failed to persist sanitized positions:', persistError);
      }
    }

    const closed = closedData ? JSON.parse(closedData) as Position[] : [];
    const removedClosed = purgeClosedWithoutChatId(closed);
    if (removedClosed > 0) {
      try {
        localStorage.setItem(CLOSED_POSITIONS_STORAGE_KEY, JSON.stringify(closed));
      } catch (persistError) {
        console.warn('[positions.store] Failed to persist sanitized closed positions:', persistError);
      }
    }

    return {
      positions,
      closed,
      settlementHistory: historyData ? JSON.parse(historyData) as Record<string, SettlementRecord> : {}
    };
  } catch (error) {
    console.warn('Failed to load positions from localStorage:', error);
    return {
      positions: new Map<string, Position>(),
      closed: [],
      settlementHistory: {}
    };
  }
}

function loadFailedJournalQueue(): FailedJournalEntry[] {
  try {
    const queueData = localStorage.getItem(FAILED_JOURNAL_QUEUE_KEY);
    return queueData ? JSON.parse(queueData) : [];
  } catch (error) {
    console.warn('Failed to load failed journal queue:', error);
    return [];
  }
}

function saveFailedJournalQueue() {
  try {
    localStorage.setItem(FAILED_JOURNAL_QUEUE_KEY, JSON.stringify(state.failedJournalQueue));
  } catch (error) {
    console.warn('Failed to save failed journal queue:', error);
  }
}

function clearOldData() {
  try {
    // Keep only the last 50 closed positions (most recent)
    if (state.closed.length > 50) {
      state.closed = state.closed.slice(-50);
      console.log('🧹 Trimmed closed positions to last 50');
    }

    // Clear old trade entries (keep only current active trades)
    const activeTradeIds = new Set();
    for (const position of state.positions.values()) {
      if (position.currentTradeId) {
        activeTradeIds.add(position.currentTradeId);
      }
    }
    
    for (const tradeId of state.tradeEntries.keys()) {
      if (!activeTradeIds.has(tradeId)) {
        state.tradeEntries.delete(tradeId);
      }
    }
    console.log('🧹 Cleared old trade entries, kept', activeTradeIds.size, 'active trades');

    // Clear failed journal queue older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    state.failedJournalQueue = state.failedJournalQueue.filter(entry => {
      const entryTime = new Date(entry.timestamp);
      return entryTime > oneDayAgo;
    });
    console.log('🧹 Cleared old failed journal entries');

  } catch (error) {
    console.error('🧹 Error during cleanup:', error);
  }
}

function loadTradeEntries(): Map<string, string> {
  try {
    const entriesData = localStorage.getItem(TRADE_ENTRIES_KEY);
    if (entriesData) {
      const entries = JSON.parse(entriesData);
      return new Map(entries);
    }
  } catch (error) {
    console.warn('Failed to load trade entries:', error);
  }
  return new Map();
}

function saveTradeEntries() {
  try {
    const entries = Array.from(state.tradeEntries.entries());
    localStorage.setItem(TRADE_ENTRIES_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Failed to save trade entries:', error);
  }
}

// Initialize state from localStorage
const initialData = loadPositionsFromStorage();

const state: { 
  positions: Map<string, Position>; 
  closed: Position[];
  tradeEntries: Map<string, string>; // tradeId -> entry timestamp
  failedJournalQueue: FailedJournalEntry[];
  settlementHistory: Record<string, SettlementRecord>;
} = {
  positions: initialData.positions,
  closed: initialData.closed,
  tradeEntries: loadTradeEntries(),
  failedJournalQueue: loadFailedJournalQueue(),
  settlementHistory: initialData.settlementHistory,
};

export function getState() { return state; }

// Expose debug functions globally for browser console
if (typeof window !== 'undefined') {
  (window as any).debugPositions = debugPositions;
  (window as any).clearAllPositions = clearAllPositions;
}

export function entry(
  symbol: string,
  side: Side,
  price: number,
  qty: number,
  name?: string,
  chatId?: string,
  metadata?: PositionMetadata,
): Position {
  if (price <= 0 || qty <= 0 || !Number.isInteger(qty)) throw new Error('invalid entry');
  const resolvedChatId = ensureChatId(chatId);
  const k = makePositionKey(symbol, side, resolvedChatId);
  let p = state.positions.get(k);
  const now = new Date().toISOString();
  
  // Check if this is initial entry (0 -> >0 transition)
  const isInitialEntry = !p || p.qtyTotal === 0;
  
  if (!p) {
    p = {
      symbol,
      side,
      qtyTotal: 0,
      avgPrice: 0,
      lots: [],
      realizedPnl: 0,
      updatedAt: now,
      name,
      chatId: resolvedChatId,
      status: 'OPEN',
      ownerId: 'current_user',
      version: 1,
      chartImageId: null,
      aiFeedbacked: false,
    };
    applyMetadata(p, metadata);
    state.positions.set(k, p);
  }
  
  // Assign new tradeId for initial entry
  if (isInitialEntry) {
    const tradeId = crypto.randomUUID();
    p.currentTradeId = tradeId;
    state.tradeEntries.set(tradeId, now);
  }
  
  const newQty = p.qtyTotal + qty;
  p.avgPrice = p.qtyTotal === 0 ? price : (p.avgPrice * p.qtyTotal + price * qty) / newQty;
  p.qtyTotal = newQty;
  p.lots.push({ price, qtyRemaining: qty, time: now });
  p.updatedAt = now;
  applyMetadata(p, metadata);
  notify();
  return p;
}

export function removeEntryLot(symbol: string, side: Side, price: number, qty: number, chatId?: string): boolean {
  if (qty <= 0) return false;
  let resolvedChatId: string;
  try {
    resolvedChatId = ensureChatId(chatId);
  } catch (error) {
    console.warn('[positions.store] removeEntryLot called without chatId', { symbol, side, chatId });
    return false;
  }
  const k = makePositionKey(symbol, side, resolvedChatId);
  const position = state.positions.get(k);
  if (!position) {
    console.warn('[positions.store] removeEntryLot: position not found', { symbol, side, chatId: resolvedChatId });
    return false;
  }

  const totalQtyBefore = position.qtyTotal;
  if (totalQtyBefore <= 0) {
    console.warn('[positions.store] removeEntryLot: no quantity to remove', { symbol, side, chatId });
    return false;
  }

  const qtyToRemove = Math.min(qty, totalQtyBefore);

  // Update lots starting from the latest entry
  let remaining = qtyToRemove;
  for (let i = position.lots.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const lot = position.lots[i];
    if (lot.qtyRemaining <= 0) continue;
    const removable = Math.min(lot.qtyRemaining, remaining);
    lot.qtyRemaining -= removable;
    remaining -= removable;
    if (lot.qtyRemaining <= 0) {
      position.lots.splice(i, 1);
    }
  }

  const totalValueBefore = position.avgPrice * totalQtyBefore;
  const totalValueAfter = Math.max(0, totalValueBefore - price * qtyToRemove);
  const totalQtyAfter = totalQtyBefore - qtyToRemove;

  if (totalQtyAfter <= 0) {
    state.positions.delete(k);
  } else {
    position.qtyTotal = totalQtyAfter;
    position.avgPrice = totalQtyAfter > 0 ? totalValueAfter / totalQtyAfter : 0;
    position.updatedAt = new Date().toISOString();
    position.status = 'OPEN';
    state.positions.set(k, position);
  }

  notify();
  return true;
}

export function updatePosition(symbol: string, side: Side, updates: Partial<Position>, chatId?: string): Position | null {
  let resolvedChatId: string;
  try {
    resolvedChatId = ensureChatId(chatId);
  } catch (error) {
    console.warn('updatePosition called without chatId', { symbol, side, chatId });
    return null;
  }
  const k = makePositionKey(symbol, side, resolvedChatId);
  const p = state.positions.get(k);
  
  if (!p) {
    console.warn('Position not found for update:', { symbol, side, chatId: resolvedChatId });
    return null;
  }
  
  // Update position with provided fields
  const updatedPosition = {
    ...p,
    ...updates,
    updatedAt: updates.updatedAt || new Date().toISOString(),
    // Guard against undefined/NaN version from legacy data
    version: (updates.version !== undefined)
      ? updates.version
      : (typeof p.version === 'number' && isFinite(p.version) ? p.version + 1 : 1)
  };
  
  state.positions.set(k, updatedPosition);
  notify();
  return updatedPosition;
}

function syncPositionFromServerInternal(position: Position): { changed: boolean; result: Position | null } {
  let resolvedChatId: string;
  try {
    resolvedChatId = ensureChatId(position.chatId);
  } catch (error) {
    console.warn('[positions.store] syncPositionFromServer: missing chatId', position);
    return { changed: false, result: null };
  }
  const identifierKey = makePositionKey(position.symbol, position.side, resolvedChatId);
  const normalised = normaliseIncomingPosition(position);
  normalised.chatId = resolvedChatId;

  if (normalised.qtyTotal <= 0 || isClosed(normalised.status)) {
    const existed = state.positions.delete(identifierKey);
    return { changed: existed, result: null };
  }

  state.positions.set(identifierKey, normalised);
  return { changed: true, result: normalised };
}

export function syncPositionFromServer(position: Position): Position | null {
  const { changed, result } = syncPositionFromServerInternal(position);
  if (changed) {
    notify();
  }
  return result;
}

export function syncPositionsBatch(positions: Position[]): void {
  if (!positions.length) {
    return;
  }

  let changed = false;
  runInBatch(() => {
    positions.forEach((position) => {
      const { changed: didChange } = syncPositionFromServerInternal(position);
      if (didChange) {
        changed = true;
      }
    });
  });

  if (changed) {
    notify();
  }
}

export function removePositionsByKeys(keys: string[]): void {
  if (!keys.length) {
    return;
  }
  let changed = false;
  runInBatch(() => {
    keys.forEach((identifierKey) => {
      if (state.positions.delete(identifierKey)) {
        changed = true;
      }
    });
  });

  if (changed) {
    notify();
  }
}

export function applyPositionsSnapshot(positions: Position[]): void {
  const next = new Map<string, Position>();

  positions.forEach((position) => {
    const normalised = normaliseIncomingPosition(position);
    if (normalised.qtyTotal <= 0 || isClosed(normalised.status)) {
      return;
    }
    if (!normalised.chatId) {
      console.warn('[positions.store] applyPositionsSnapshot skipped position without chatId', normalised);
      return;
    }
    const identifierKey = makePositionKey(normalised.symbol, normalised.side, normalised.chatId);
    next.set(identifierKey, normalised);
  });

  runInBatch(() => {
    state.positions = next;
  });

  notify();
}

export function settle(symbol: string, side: Side, price: number, qty: number, chatId?: string) {
  const resolvedChatId = ensureChatId(chatId);
  const k = makePositionKey(symbol, side, resolvedChatId);
  const p = state.positions.get(k);
  if (!p) throw new Error('ポジションが見つかりません');
  if (qty > p.qtyTotal) throw new Error(`決済数量が保有数量を超えています（保有: ${p.qtyTotal}株）`);

  const matchedLots: { lotPrice: number; qty: number; pnl: number }[] = [];
  let remaining = qty;
  let realized = 0;
  const startQtyTotal = p.qtyTotal;
  const startAvg = p.avgPrice; // 固定平均建値（証券会社風）

  for (const lot of p.lots) {
    if (remaining <= 0) break;
    if (lot.qtyRemaining <= 0) continue;
    const use = Math.min(lot.qtyRemaining, remaining);
    const pnl = p.side === 'LONG' ? (price - lot.price) * use : (lot.price - price) * use;
    realized += pnl;
    lot.qtyRemaining -= use;
    remaining -= use;
    matchedLots.push({ lotPrice: lot.price, qty: use, pnl });
  }

  const wasQtyTotal = p.qtyTotal;
  p.qtyTotal -= qty;
  p.lots = p.lots.filter(l => l.qtyRemaining > 0);
  // 平均建値は売却では変えない（固定）。完全クローズ時のみ0。
  p.avgPrice = p.qtyTotal > 0 ? startAvg : 0;
  p.realizedPnl += realized;
  p.updatedAt = new Date().toISOString();

  let positionResult: Position | null = p;
  let tradeSnapshot: TradeSnapshot | null = null;
  
  // Check for complete close (qtyTotal becomes 0)
  if (p.qtyTotal === 0) {
    // When possible, create a trade snapshot using tracked entry time
    if (p.currentTradeId && state.tradeEntries.has(p.currentTradeId)) {
      const entryTime = state.tradeEntries.get(p.currentTradeId)!;
      const closeTime = new Date().toISOString();
      const holdMinutes = Math.floor((new Date(closeTime).getTime() - new Date(entryTime).getTime()) / 60000);

      const avgEntry = startAvg; // fixed average entry

      let pnlPct = 0;
      if (avgEntry > 0) {
        pnlPct = side === 'LONG'
          ? ((price - avgEntry) / avgEntry) * 100
          : ((avgEntry - price) / avgEntry) * 100;
        if (!isFinite(pnlPct)) pnlPct = 0;
      }

      tradeSnapshot = {
        tradeId: p.currentTradeId,
        chatId: resolvedChatId,
        symbol,
        side,
        avgEntry: isFinite(avgEntry) ? avgEntry : 0,
        avgExit: price,
        qty: wasQtyTotal,
        pnlAbs: isFinite(realized) ? realized : 0,
        pnlPct,
        holdMinutes,
        closedAt: closeTime.replace(/\.\d{3}Z$/, 'Z'),
        chartPattern: p.chartPattern,
      };

      // Clear trade tracking
      state.tradeEntries.delete(p.currentTradeId);
      delete p.currentTradeId;
    }

    // In all cases, remove from open positions and archive into closed
    state.positions.delete(k);
    state.closed.push(p);
    positionResult = null;
  }

  notify();
  return { position: positionResult, realizedPnl: realized, details: { matchedLots }, tradeSnapshot };
}

// Record settlement (link EXIT message id -> matched lots) for exact undo
export function recordSettlement(exitMessageId: string, record: Omit<SettlementRecord, 'createdAt' | 'undone'>) {
  state.settlementHistory[exitMessageId] = {
    ...record,
    createdAt: new Date().toISOString(),
    undone: false,
  };
  saveSettlementHistory();
}

export function getSettlementRecord(exitMessageId: string): SettlementRecord | undefined {
  return state.settlementHistory[exitMessageId];
}

// Undo settlement using the recorded history; returns true if applied
export function unsettle(exitMessageId: string): boolean {
  const rec = state.settlementHistory[exitMessageId];
  if (!rec || rec.undone) return false;

  const kpos = key(rec.symbol, rec.side, rec.chatId);
  let pos = state.positions.get(kpos);
  const now = new Date().toISOString();

  // If position was closed, revive basic structure
  if (!pos) {
    pos = {
      symbol: rec.symbol,
      side: rec.side,
      qtyTotal: 0,
      avgPrice: 0,
      lots: [],
      realizedPnl: 0,
      updatedAt: now,
      chatId: rec.chatId,
      status: 'OPEN',
      ownerId: 'current_user',
      version: 1,
      name: undefined,
      currentTradeId: undefined,
      chartImageId: null,
      aiFeedbacked: false,
    };
    state.positions.set(kpos, pos);
    // Remove one closed record if present
    const idx = state.closed.findIndex(c => c.symbol === rec.symbol && c.side === rec.side && c.chatId === rec.chatId);
    if (idx >= 0) state.closed.splice(idx, 1);
  }

  // Restore consumed lots
  for (const lot of rec.matchedLots) {
    pos!.lots.push({ price: lot.lotPrice, qtyRemaining: lot.qty, time: now });
    pos!.qtyTotal += lot.qty;
  }
  // Recompute average price
  if (pos!.qtyTotal > 0) {
    const totalVal = pos!.lots.reduce((s, l) => s + l.price * l.qtyRemaining, 0);
    const totalQty = pos!.lots.reduce((s, l) => s + l.qtyRemaining, 0);
    pos!.avgPrice = totalQty > 0 ? totalVal / totalQty : 0;
  } else {
    pos!.avgPrice = 0;
  }
  pos!.realizedPnl = (pos!.realizedPnl || 0) - (rec.realizedPnl || 0);
  pos!.updatedAt = now;
  pos!.status = 'OPEN';
  pos!.version += 1;

  // Mark as undone
  rec.undone = true;
  savePositionsToStorage();
  notify();
  return true;
}

export function getGroups(chatId?: string): SymbolGroup[] {
  const bySymbol = new Map<string, { name?: string; positions: Position[] }>();
  for (const p of state.positions.values()) {
    if (chatId && p.chatId !== chatId) {
      continue;
    }
    const entry = bySymbol.get(p.symbol) ?? { positions: [] as Position[] };
    entry.positions.push(p);
    bySymbol.set(p.symbol, entry);
  }
  return Array.from(bySymbol.entries()).map(([symbol, v]) => ({ symbol, positions: v.positions }));
}

export function getLongShortQty(symbol: string, chatId?: string) {
  let resolvedChatId: string;
  try {
    resolvedChatId = ensureChatId(chatId);
  } catch (error) {
    return { long: 0, short: 0 };
  }
  const long = state.positions.get(makePositionKey(symbol, 'LONG', resolvedChatId))?.qtyTotal ?? 0;
  const short = state.positions.get(makePositionKey(symbol, 'SHORT', resolvedChatId))?.qtyTotal ?? 0;
  return { long, short };
}

// Explicitly delete a position (user-initiated removal)
export function deletePosition(symbol: string, side: Side, chatId?: string): boolean {
  console.log('[positions.store] deletePosition called', { symbol, side, chatId });
  let resolvedChatId: string;
  try {
    resolvedChatId = ensureChatId(chatId);
  } catch (error) {
    console.warn('[positions.store] deletePosition without chatId', { symbol, side, chatId });
    return false;
  }

  const identifierKey = makePositionKey(symbol, side, resolvedChatId);

  if (state.positions.has(identifierKey)) {
    console.log('[positions.store] deleting key', identifierKey);
    state.positions.delete(identifierKey);
    notify();
    return true;
  }

  console.warn('[positions.store] deletePosition: no matching key found', { identifierKey });
  return false;
}

// Debug and utility functions
export function clearAllPositions() {
  state.positions.clear();
  state.closed.length = 0;
  state.tradeEntries.clear();
  state.failedJournalQueue.length = 0;
  state.settlementHistory = {};
  
  // Also clear localStorage directly
  try {
    localStorage.removeItem(POSITIONS_STORAGE_KEY);
    localStorage.removeItem(CLOSED_POSITIONS_STORAGE_KEY);
    localStorage.removeItem(TRADE_ENTRIES_KEY);
    localStorage.removeItem(SETTLEMENT_HISTORY_KEY);
    localStorage.removeItem(FAILED_JOURNAL_QUEUE_KEY);
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }
  
  savePositionsToStorage();
  notify();
  console.log('🧙 All positions and storage cleared');
}

export function debugPositions() {
  console.log('🔍 Debug - All positions:');
  console.log('Positions Map:', Array.from(state.positions.entries()));
  console.log('Closed positions:', state.closed);
  console.log('LocalStorage data:');
  console.log('- positions:', localStorage.getItem(POSITIONS_STORAGE_KEY));
  console.log('- closed:', localStorage.getItem(CLOSED_POSITIONS_STORAGE_KEY));
  console.log('- settlementHistory:', localStorage.getItem(SETTLEMENT_HISTORY_KEY));
}

// Journal API functions
const getApiUrl = () => {
  const fallback = isDevelopmentEnv() ? 'http://localhost:8000' : '';
  return resolveApiBaseUrl(fallback);
};

// ===== Settlement (EXIT) history for accurate Undo =====
export interface SettlementRecordLot { lotPrice: number; qty: number }
export interface SettlementRecord {
  symbol: string;
  side: Side;
  chatId?: string;
  exitPrice: number;
  exitQty: number;
  realizedPnl: number;
  matchedLots: SettlementRecordLot[];
  createdAt: string;
  undone?: boolean;
}

function saveSettlementHistory() {
  try {
    localStorage.setItem(SETTLEMENT_HISTORY_KEY, JSON.stringify(state.settlementHistory));
  } catch (e) {
    console.warn('Failed to save settlement history:', e);
  }
}

function loadSettlementHistory(): Record<string, SettlementRecord> {
  try {
    const raw = localStorage.getItem(SETTLEMENT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function submitJournalEntry(tradeSnapshot: TradeSnapshot): Promise<boolean> {
  try {
    // Convert camelCase to snake_case for API
    const payload = {
      trade_id: tradeSnapshot.tradeId,
      user_id: null, // Add user_id field as required by schema
      chat_id: tradeSnapshot.chatId,
      symbol: tradeSnapshot.symbol,
      side: tradeSnapshot.side,
      avg_entry: tradeSnapshot.avgEntry,
      avg_exit: tradeSnapshot.avgExit,
      qty: tradeSnapshot.qty,
      pnl_abs: tradeSnapshot.pnlAbs,
      pnl_pct: tradeSnapshot.pnlPct,
      hold_minutes: tradeSnapshot.holdMinutes,
      closed_at: tradeSnapshot.closedAt.replace(/\.\d{3}Z$/, 'Z'), // Ensure proper ISO format
      feedback: tradeSnapshot.feedback ? {
        text: tradeSnapshot.feedback.text,
        tone: tradeSnapshot.feedback.tone,
        next_actions: tradeSnapshot.feedback.nextActions,
        message_id: tradeSnapshot.feedback.messageId
      } : undefined,
      pattern: tradeSnapshot.chartPattern,
      analysis: tradeSnapshot.analysis ? {
        score: tradeSnapshot.analysis.score,
        labels: tradeSnapshot.analysis.labels
      } : undefined
    };
    
    const response = await fetch(`${getApiUrl()}/journal/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      // Get detailed error message
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('📋 Full Journal API error response:', JSON.stringify(errorData, null, 2));
        
        // Extract error details properly
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorDetail = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // Pydantic validation errors
            errorDetail = errorData.detail.map((err: any) => {
              const location = err.loc ? err.loc.join('.') : 'unknown_field';
              return `${location}: ${err.msg} (type: ${err.type || 'unknown'})`;
            }).join(', ');
            console.error('📋 Pydantic validation errors:', errorData.detail);
          } else {
            errorDetail = JSON.stringify(errorData.detail);
          }
        } else if (errorData.message) {
          errorDetail = errorData.message;
        } else {
          errorDetail = JSON.stringify(errorData);
        }
      } catch (e) {
        // If we can't parse JSON, use status text
        errorDetail = response.statusText || errorDetail;
      }
      console.error('📋 Journal API processed error:', errorDetail);
      throw new Error(`Journal API error: ${response.status} - ${errorDetail}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Journal submission failed:', error);
    
    // DISABLED: Add to failed queue for retry to prevent spam
    // const failedEntry: FailedJournalEntry = {
    //   tradeSnapshot,
    //   timestamp: new Date().toISOString(),
    //   retryCount: 0
    // };
    // 
    // state.failedJournalQueue.push(failedEntry);
    // saveFailedJournalQueue();
    
    return false;
  }
}

export async function retryFailedJournalEntries(): Promise<void> {
  if (state.failedJournalQueue.length === 0) return;
  
  console.log(`🔄 Retrying ${state.failedJournalQueue.length} failed journal entries`);
  
  const entriesToRetry = [...state.failedJournalQueue];
  state.failedJournalQueue = [];
  
  for (const entry of entriesToRetry) {
    entry.retryCount++;
    
    const success = await submitJournalEntry(entry.tradeSnapshot);
    
    if (!success && entry.retryCount < 3) {
      // Re-add to queue if retry count < 3
      state.failedJournalQueue.push(entry);
    }
  }
  
  saveFailedJournalQueue();
}

// Auto-retry failed entries on store initialization - DISABLED to prevent spam
// if (typeof window !== 'undefined') {
//   setTimeout(() => {
//     retryFailedJournalEntries();
//   }, 5000); // Retry after 5 seconds
// }

// Initialize store from localStorage
