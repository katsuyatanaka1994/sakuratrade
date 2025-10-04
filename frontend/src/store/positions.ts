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
  currentTradeId?: string; // ULID for trade journal tracking
  status?: 'OPEN' | 'CLOSED'; // Position status for edit permissions
  ownerId?: string; // Owner ID for edit permissions
  version: number; // Version for optimistic locking
  // Chart analysis linkage
  chartImageId?: string | null;
  aiFeedbacked?: boolean;
}
export interface SymbolGroup { symbol: string; name?: string; positions: Position[] }

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { 
  listeners.forEach(fn => fn()); 
  // Save to localStorage whenever state changes
  savePositionsToStorage();
}
export function subscribe(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

export const makePositionKey = (symbol: string, side: Side, chatId?: string | null) => `${symbol}:${side}:${chatId || 'default'}`;

const key = makePositionKey;

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
    
    return {
      positions: positionsData ? deserializePositions(positionsData) : new Map<string, Position>(),
      closed: closedData ? JSON.parse(closedData) : [],
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

export function entry(symbol: string, side: Side, price: number, qty: number, name?: string, chatId?: string): Position {
  if (price <= 0 || qty <= 0 || !Number.isInteger(qty)) throw new Error('invalid entry');
  const k = key(symbol, side, chatId);
  let p = state.positions.get(k);
  const now = new Date().toISOString();
  
  // Check if this is initial entry (0 -> >0 transition)
  const isInitialEntry = !p || p.qtyTotal === 0;
  
  if (!p) {
    p = { symbol, side, qtyTotal: 0, avgPrice: 0, lots: [], realizedPnl: 0, updatedAt: now, name, chatId, status: 'OPEN', ownerId: 'current_user', version: 1, chartImageId: null, aiFeedbacked: false };
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
  notify();
  return p;
}

export function removeEntryLot(symbol: string, side: Side, price: number, qty: number, chatId?: string): boolean {
  if (qty <= 0) return false;
  const k = key(symbol, side, chatId);
  const position = state.positions.get(k);
  if (!position) {
    console.warn('[positions.store] removeEntryLot: position not found', { symbol, side, chatId });
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
  const k = key(symbol, side, chatId);
  const p = state.positions.get(k);
  
  if (!p) {
    console.warn('Position not found for update:', { symbol, side, chatId });
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

export function syncPositionFromServer(position: Position): Position | null {
  const identifierKey = makePositionKey(position.symbol, position.side, position.chatId);

  if (position.qtyTotal <= 0) {
    const existed = state.positions.delete(identifierKey);
    if (existed) {
      notify();
    }
    return null;
  }

  const normalisedPosition: Position = {
    ...position,
    updatedAt: position.updatedAt || new Date().toISOString(),
    status: position.status ?? 'OPEN',
  };

  state.positions.set(identifierKey, normalisedPosition);
  notify();
  return normalisedPosition;
}

export function settle(symbol: string, side: Side, price: number, qty: number, chatId?: string) {
  const k = key(symbol, side, chatId);
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
        chatId: chatId || 'default',
        symbol,
        side,
        avgEntry: isFinite(avgEntry) ? avgEntry : 0,
        avgExit: price,
        qty: wasQtyTotal,
        pnlAbs: isFinite(realized) ? realized : 0,
        pnlPct,
        holdMinutes,
        closedAt: closeTime.replace(/\.\d{3}Z$/, 'Z')
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
  const long = state.positions.get(key(symbol, 'LONG', chatId))?.qtyTotal ?? 0;
  const short = state.positions.get(key(symbol, 'SHORT', chatId))?.qtyTotal ?? 0;
  return { long, short };
}

// Explicitly delete a position (user-initiated removal)
export function deletePosition(symbol: string, side: Side, chatId?: string): boolean {
  console.log('[positions.store] deletePosition called', { symbol, side, chatId });
  // Try exact key first
  const tryKeys: string[] = [];
  tryKeys.push(key(symbol, side, chatId));
  // Fallbacks for legacy/default chatId
  if (chatId && chatId !== 'default') {
    tryKeys.push(key(symbol, side, 'default'));
  }
  // As a last resort, search by symbol+side (ignore chatId)
  const anyKey = Array.from(state.positions.keys()).find(k => k.startsWith(`${symbol}:${side}:`));
  if (anyKey) tryKeys.push(anyKey);

  for (const kpos of tryKeys) {
    if (state.positions.has(kpos)) {
      console.log('[positions.store] deleting key', kpos);
      state.positions.delete(kpos);
      notify();
      return true;
    }
  }
  console.warn('[positions.store] deletePosition: no matching key found', { tryKeys, keys: Array.from(state.positions.keys()) });
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
