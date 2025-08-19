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

const key = (symbol: string, side: Side, chatId?: string) => `${symbol}:${side}:${chatId || 'default'}`;

// localStorage keys for persistence
const POSITIONS_STORAGE_KEY = 'positions_data';
const CLOSED_POSITIONS_STORAGE_KEY = 'closed_positions_data';
const TRADE_ENTRIES_KEY = 'trade_entries'; // Track entry timestamps per tradeId

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
    saveFailedJournalQueue();
  } catch (error) {
    console.warn('Failed to save positions to localStorage:', error);
  }
}

function loadPositionsFromStorage() {
  try {
    const positionsData = localStorage.getItem(POSITIONS_STORAGE_KEY);
    const closedData = localStorage.getItem(CLOSED_POSITIONS_STORAGE_KEY);
    
    return {
      positions: positionsData ? deserializePositions(positionsData) : new Map<string, Position>(),
      closed: closedData ? JSON.parse(closedData) : []
    };
  } catch (error) {
    console.warn('Failed to load positions from localStorage:', error);
    return {
      positions: new Map<string, Position>(),
      closed: []
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
} = {
  positions: initialData.positions,
  closed: initialData.closed,
  tradeEntries: loadTradeEntries(),
  failedJournalQueue: loadFailedJournalQueue(),
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
  console.log('💾 Position entry - key:', k, 'chatId:', chatId);
  let p = state.positions.get(k);
  const now = new Date().toISOString();
  
  // Check if this is initial entry (0 -> >0 transition)
  const isInitialEntry = !p || p.qtyTotal === 0;
  
  if (!p) {
    p = { symbol, side, qtyTotal: 0, avgPrice: 0, lots: [], realizedPnl: 0, updatedAt: now, name, chatId };
    state.positions.set(k, p);
  }
  
  // Assign new tradeId for initial entry
  if (isInitialEntry) {
    const tradeId = crypto.randomUUID();
    p.currentTradeId = tradeId;
    state.tradeEntries.set(tradeId, now);
    console.log('🆕 New trade started:', tradeId, 'for', symbol, side);
  }
  
  const newQty = p.qtyTotal + qty;
  p.avgPrice = p.qtyTotal === 0 ? price : (p.avgPrice * p.qtyTotal + price * qty) / newQty;
  p.qtyTotal = newQty;
  p.lots.push({ price, qtyRemaining: qty, time: now });
  p.updatedAt = now;
  notify();
  console.log('💾 Position saved to localStorage');
  return p;
}

export function settle(symbol: string, side: Side, price: number, qty: number, chatId?: string) {
  const k = key(symbol, side, chatId);
  const p = state.positions.get(k);
  if (!p) throw new Error('ポジションが見つかりません');
  if (qty > p.qtyTotal) throw new Error(`決済数量が保有数量を超えています（保有: ${p.qtyTotal}株）`);

  const matchedLots: { lotPrice: number; qty: number; pnl: number }[] = [];
  let remaining = qty;
  let realized = 0;

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
  p.avgPrice = p.qtyTotal > 0 ? p.lots.reduce((acc, l) => acc + l.price * l.qtyRemaining, 0) / p.qtyTotal : 0;
  p.realizedPnl += realized;
  p.updatedAt = new Date().toISOString();

  let positionResult: Position | null = p;
  let tradeSnapshot: TradeSnapshot | null = null;
  
  // Check for complete close (qtyTotal becomes 0)
  if (p.qtyTotal === 0 && p.currentTradeId && state.tradeEntries.has(p.currentTradeId)) {
    const entryTime = state.tradeEntries.get(p.currentTradeId)!;
    const closeTime = new Date().toISOString();
    const holdMinutes = Math.floor((new Date(closeTime).getTime() - new Date(entryTime).getTime()) / 60000);
    
    // Calculate average entry price from all lots in this trade
    const avgEntry = p.lots.length > 0 ? 
      p.lots.reduce((sum, lot) => sum + lot.price, 0) / p.lots.length :
      p.avgPrice;
    
    tradeSnapshot = {
      tradeId: p.currentTradeId,
      chatId: chatId || 'default',
      symbol,
      side,
      avgEntry,
      avgExit: price,
      qty: wasQtyTotal,
      pnlAbs: realized,
      pnlPct: ((price - avgEntry) / avgEntry) * 100 * (side === 'LONG' ? 1 : -1),
      holdMinutes,
      closedAt: closeTime
    };
    
    // Clear trade tracking
    state.tradeEntries.delete(p.currentTradeId);
    delete p.currentTradeId;
    
    state.positions.delete(k);
    state.closed.push(p);
    positionResult = null;
    
    console.log('🏁 Trade completed:', tradeSnapshot.tradeId);
  }

  notify();
  console.log('💾 Position settlement saved to localStorage');
  return { position: positionResult, realizedPnl: realized, details: { matchedLots }, tradeSnapshot };
}

export function getGroups(chatId?: string): SymbolGroup[] {
  console.log('🔍 getGroups called with chatId:', chatId);
  const bySymbol = new Map<string, { name?: string; positions: Position[] }>();
  for (const p of state.positions.values()) {
    console.log('🔍 Checking position:', p.symbol, p.side, 'chatId:', p.chatId, 'filter chatId:', chatId);
    if (chatId && p.chatId !== chatId) {
      console.log('⚠️ Skipping position due to chatId mismatch');
      continue;
    }
    const entry = bySymbol.get(p.symbol) ?? { positions: [] as Position[] };
    entry.positions.push(p);
    bySymbol.set(p.symbol, entry);
  }
  console.log('🔍 getGroups result for chatId', chatId, ':', Array.from(bySymbol.keys()));
  return Array.from(bySymbol.entries()).map(([symbol, v]) => ({ symbol, positions: v.positions }));
}

export function getLongShortQty(symbol: string, chatId?: string) {
  const long = state.positions.get(key(symbol, 'LONG', chatId))?.qtyTotal ?? 0;
  const short = state.positions.get(key(symbol, 'SHORT', chatId))?.qtyTotal ?? 0;
  return { long, short };
}

// Debug and utility functions
export function clearAllPositions() {
  state.positions.clear();
  state.closed.length = 0;
  savePositionsToStorage();
  notify();
  console.log('🧙 All positions cleared from storage');
}

export function debugPositions() {
  console.log('🔍 Debug - All positions:');
  console.log('Positions Map:', Array.from(state.positions.entries()));
  console.log('Closed positions:', state.closed);
  console.log('LocalStorage data:');
  console.log('- positions:', localStorage.getItem(POSITIONS_STORAGE_KEY));
  console.log('- closed:', localStorage.getItem(CLOSED_POSITIONS_STORAGE_KEY));
}

// Journal API functions
const getApiUrl = () => {
  return process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';
};

export async function submitJournalEntry(tradeSnapshot: TradeSnapshot): Promise<boolean> {
  try {
    // Convert camelCase to snake_case for API
    const payload = {
      trade_id: tradeSnapshot.tradeId,
      chat_id: tradeSnapshot.chatId,
      symbol: tradeSnapshot.symbol,
      side: tradeSnapshot.side,
      avg_entry: tradeSnapshot.avgEntry,
      avg_exit: tradeSnapshot.avgExit,
      qty: tradeSnapshot.qty,
      pnl_abs: tradeSnapshot.pnlAbs,
      pnl_pct: tradeSnapshot.pnlPct,
      hold_minutes: tradeSnapshot.holdMinutes,
      closed_at: tradeSnapshot.closedAt,
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
    
    console.log('📋 Sending payload to journal API:', payload);
    
    const response = await fetch(`${getApiUrl()}/journal/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Journal API error: ${response.status}`);
    }
    
    console.log('📋 Journal entry submitted:', tradeSnapshot.tradeId);
    return true;
  } catch (error) {
    console.error('❌ Journal submission failed:', error);
    
    // Add to failed queue for retry
    const failedEntry: FailedJournalEntry = {
      tradeSnapshot,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    state.failedJournalQueue.push(failedEntry);
    saveFailedJournalQueue();
    
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

// Auto-retry failed entries on store initialization
if (typeof window !== 'undefined') {
  setTimeout(() => {
    retryFailedJournalEntries();
  }, 5000); // Retry after 5 seconds
}

// Initialize debug logging
console.log('🚀 Positions store initialized from localStorage');
console.log(`📁 Loaded ${state.positions.size} positions, ${state.closed.length} closed positions`);
console.log(`🔄 Loaded ${state.failedJournalQueue.length} failed journal entries for retry`);