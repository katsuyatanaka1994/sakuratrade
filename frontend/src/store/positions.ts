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
}
export interface SymbolGroup { symbol: string; name?: string; positions: Position[] }

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }
export function subscribe(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

const key = (symbol: string, side: Side) => `${symbol}:${side}`;

const state: { positions: Map<string, Position>; closed: Position[] } = {
  positions: new Map<string, Position>(),
  closed: [],
};

export function getState() { return state; }

export function entry(symbol: string, side: Side, price: number, qty: number, name?: string): Position {
  if (price <= 0 || qty <= 0 || !Number.isInteger(qty)) throw new Error('invalid entry');
  const k = key(symbol, side);
  let p = state.positions.get(k);
  const now = new Date().toISOString();
  if (!p) {
    p = { symbol, side, qtyTotal: 0, avgPrice: 0, lots: [], realizedPnl: 0, updatedAt: now, name };
    state.positions.set(k, p);
  }
  const newQty = p.qtyTotal + qty;
  p.avgPrice = p.qtyTotal === 0 ? price : (p.avgPrice * p.qtyTotal + price * qty) / newQty;
  p.qtyTotal = newQty;
  p.lots.push({ price, qtyRemaining: qty, time: now });
  p.updatedAt = now;
  notify();
  return p;
}

export function settle(symbol: string, side: Side, price: number, qty: number) {
  const k = key(symbol, side);
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
  return { position: positionResult, realizedPnl: realized, details: { matchedLots } };
}

export function getGroups(): SymbolGroup[] {
  const bySymbol = new Map<string, { name?: string; positions: Position[] }>();
  for (const p of state.positions.values()) {
    const entry = bySymbol.get(p.symbol) ?? { positions: [] as Position[] };
    entry.positions.push(p);
    bySymbol.set(p.symbol, entry);
  }
  return Array.from(bySymbol.entries()).map(([symbol, v]) => ({ symbol, positions: v.positions }));
}

export function getLongShortQty(symbol: string) {
  const long = state.positions.get(key(symbol, 'LONG'))?.qtyTotal ?? 0;
  const short = state.positions.get(key(symbol, 'SHORT'))?.qtyTotal ?? 0;
  return { long, short };
}