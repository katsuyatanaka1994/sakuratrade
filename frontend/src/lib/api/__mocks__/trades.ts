import type { TradeFilter, TradeListResp, TradeListItem } from '../../../types/trades';

// サンプルデータ
const mockTrades: TradeListItem[] = [
  {
    id: 'tr_001',
    symbol: '7203',
    symbol_name: 'トヨタ自動車',
    side: 'long',
    entry_at: '2025-01-15T09:23:00+09:00',
    entry_price: 3085.0,
    exit_at: '2025-01-15T10:12:00+09:00',
    exit_price: 3162.0,
    qty: 100,
    pnl: 7700.0,
    pnl_pct: 2.5,
    tag: 'profit'
  },
  {
    id: 'tr_002',
    symbol: '6758',
    symbol_name: 'ソニーグループ',
    side: 'long',
    entry_at: '2025-01-14T14:30:00+09:00',
    entry_price: 13420.0,
    exit_at: '2025-01-14T15:45:00+09:00',
    exit_price: 13185.0,
    qty: 10,
    pnl: -2350.0,
    pnl_pct: -1.8,
    tag: 'loss'
  },
  {
    id: 'tr_003',
    symbol: '9984',
    symbol_name: 'ソフトバンクグループ',
    side: 'short',
    entry_at: '2025-01-13T11:15:00+09:00',
    entry_price: 8630.0,
    exit_at: '2025-01-13T13:20:00+09:00',
    exit_price: 8515.0,
    qty: 50,
    pnl: 5750.0,
    pnl_pct: 1.3,
    tag: 'profit'
  },
  {
    id: 'tr_004',
    symbol: '4063',
    symbol_name: '信越化学工業',
    side: 'long',
    entry_at: '2025-01-12T10:00:00+09:00',
    entry_price: 4890.0,
    exit_at: null,
    exit_price: null,
    qty: 200,
    pnl: null,
    pnl_pct: null,
    tag: 'flat'
  },
];

/**
 * モック版のトレード取得API
 */
export async function fetchTrades(filters: TradeFilter = {}): Promise<TradeListResp> {
  // 実際のAPIコールをシミュレート
  await new Promise(resolve => setTimeout(resolve, 500));

  let filteredTrades = [...mockTrades];

  // フィルタリング
  if (filters.type && filters.type !== 'all') {
    filteredTrades = filteredTrades.filter(trade => trade.tag === filters.type);
  }

  if (filters.q) {
    const query = filters.q.toLowerCase();
    filteredTrades = filteredTrades.filter(trade => 
      trade.symbol.toLowerCase().includes(query) ||
      trade.symbol_name.toLowerCase().includes(query)
    );
  }

  if (filters.from) {
    const fromDate = new Date(filters.from);
    filteredTrades = filteredTrades.filter(trade => {
      const tradeDate = new Date(trade.entry_at);
      return tradeDate >= fromDate;
    });
  }

  if (filters.to) {
    const toDate = new Date(filters.to);
    // 終日を含むため23:59:59まで
    toDate.setHours(23, 59, 59, 999);
    filteredTrades = filteredTrades.filter(trade => {
      const tradeDate = new Date(trade.entry_at);
      return tradeDate <= toDate;
    });
  }

  // ページング
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTrades = filteredTrades.slice(startIndex, endIndex);

  return {
    items: paginatedTrades,
    meta: {
      total: filteredTrades.length,
      page,
      page_size: pageSize,
      has_next: endIndex < filteredTrades.length,
      applied_filters: {
        from: filters.from,
        to: filters.to,
        q: filters.q,
        type: filters.type || null,
        timeframe: filters.timeframe,
        side: filters.side,
      }
    }
  };
}