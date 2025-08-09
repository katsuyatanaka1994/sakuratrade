export type Side = 'LONG' | 'SHORT';

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

// Initialize state from localStorage
const initialData = loadPositionsFromStorage();

const state: { positions: Map<string, Position>; closed: Position[] } = {
  positions: initialData.positions,
  closed: initialData.closed,
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
  if (!p) {
    p = { symbol, side, qtyTotal: 0, avgPrice: 0, lots: [], realizedPnl: 0, updatedAt: now, name, chatId };
    state.positions.set(k, p);
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

  p.qtyTotal -= qty;
  p.lots = p.lots.filter(l => l.qtyRemaining > 0);
  p.avgPrice = p.qtyTotal > 0 ? p.lots.reduce((acc, l) => acc + l.price * l.qtyRemaining, 0) / p.qtyTotal : 0;
  p.realizedPnl += realized;
  p.updatedAt = new Date().toISOString();

  let positionResult: Position | null = p;
  if (p.qtyTotal === 0) {
    state.positions.delete(k);
    state.closed.push(p);
    positionResult = null;
  }

  notify();
  console.log('💾 Position settlement saved to localStorage');
  return { position: positionResult, realizedPnl: realized, details: { matchedLots } };
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

// Initialize debug logging
console.log('🚀 Positions store initialized from localStorage');
console.log(`📁 Loaded ${state.positions.size} positions, ${state.closed.length} closed positions`);