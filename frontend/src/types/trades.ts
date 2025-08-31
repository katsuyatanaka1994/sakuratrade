export type TradeType = 'all' | 'profit' | 'loss';
export type Side = 'long' | 'short';

export interface TradeFilter {
  from?: string;      // ISO: 'YYYY-MM-DD'
  to?: string;        // ISO: 'YYYY-MM-DD'
  q?: string;
  type?: TradeType;   // default: 'all'
  page?: number;      // default: 1
  page_size?: number; // default: 20
  timeframe?: '1m'|'5m'|'15m'|'1d';
  side?: Side;
}

export interface TradeListItem {
  id: string;
  symbol: string;
  symbol_name: string;
  side: Side;
  entry_at: string;
  entry_price: number;
  exit_at: string | null;
  exit_price: number | null;
  qty: number;
  pnl: number | null;
  pnl_pct: number | null;
  tag: 'profit'|'loss'|'flat';
}

export interface TradeListResp {
  items: TradeListItem[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    has_next: boolean;
    applied_filters: Omit<TradeFilter,'page'|'page_size'> & { type: TradeType | null };
  };
}

// UI用の型（Date型を使用）
export interface TradeFilterRuntime {
  from?: Date | null;
  to?: Date | null;
  q?: string;
  type?: TradeType;
}

export interface DateRange {
  from?: Date | null;
  to?: Date | null;
}