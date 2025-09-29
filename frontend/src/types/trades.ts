// frontend/src/types/trades.ts
// Type-only definitions used across the trading UI. No runtime imports here.

export type TradeType = 'all' | 'profit' | 'loss';

export type Side = 'long' | 'short';

/**
 * UI filter shape for the trades list.
 * Dates are ISO strings (YYYY-MM-DD) because TextField(type="date") works with strings.
 */
export interface TradeFilter {
  from?: string;   // e.g. '2025-09-26'
  to?: string;     // e.g. '2025-09-30'
  q?: string;
  type?: TradeType;
  side?: '' | Side; // empty string = All
}

/**
 * Domain-level date range (elsewhere you might use Date objects).
 * Keep for non-UI logic that prefers Date|null.
 */
export interface DateRange {
  from?: Date | null;
  to?: Date | null;
}