import React, { useState, useEffect, useCallback } from 'react';
import { FilterButton } from '../components/FilterButton';
import { FilterDialog } from '../components/FilterDialog';
import { fetchTrades, formatDateToISO, TradesApiError } from '../lib/api/trades';
import type { TradeFilter, TradeFilterRuntime, TradeListResp, TradeListItem } from '../types/trades';

export const TradesPage: React.FC = () => {
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [meta, setMeta] = useState<TradeListResp['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [filters, setFilters] = useState<TradeFilterRuntime>({
    type: 'all',
  });

  // URL クエリ同期のためのヘルパー
  const updateURLQuery = useCallback((filters: TradeFilterRuntime) => {
    const params = new URLSearchParams();
    
    if (filters.from) params.set('from', formatDateToISO(filters.from));
    if (filters.to) params.set('to', formatDateToISO(filters.to));
    if (filters.q) params.set('q', filters.q);
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);

    const newURL = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newURL);
  }, []);

  // URL クエリからフィルターを読み込み
  const loadFiltersFromURL = useCallback((): TradeFilterRuntime => {
    const params = new URLSearchParams(window.location.search);
    const filters: TradeFilterRuntime = { type: 'all' };

    const fromStr = params.get('from');
    if (fromStr) {
      const fromDate = new Date(fromStr);
      if (!isNaN(fromDate.getTime())) {
        filters.from = fromDate;
      }
    }

    const toStr = params.get('to');
    if (toStr) {
      const toDate = new Date(toStr);
      if (!isNaN(toDate.getTime())) {
        filters.to = toDate;
      }
    }

    const q = params.get('q');
    if (q) filters.q = q;

    const type = params.get('type');
    if (type === 'profit' || type === 'loss') {
      filters.type = type;
    }

    return filters;
  }, []);

  // フィルターをAPI用の形式に変換
  const convertFiltersForAPI = useCallback((filters: TradeFilterRuntime): TradeFilter => {
    const apiFilters: TradeFilter = {};

    if (filters.from) apiFilters.from = formatDateToISO(filters.from);
    if (filters.to) apiFilters.to = formatDateToISO(filters.to);
    if (filters.q) apiFilters.q = filters.q;
    if (filters.type) apiFilters.type = filters.type;

    return apiFilters;
  }, []);

  // データ取得
  const loadTrades = useCallback(async (filters: TradeFilterRuntime) => {
    setLoading(true);
    setError(null);

    try {
      const apiFilters = convertFiltersForAPI(filters);
      const response = await fetchTrades(apiFilters);
      setTrades(response.items);
      setMeta(response.meta);
    } catch (err) {
      if (err instanceof TradesApiError) {
        setError(err.message);
      } else {
        setError('データの取得に失敗しました');
      }
      console.error('Failed to fetch trades:', err);
    } finally {
      setLoading(false);
    }
  }, [convertFiltersForAPI]);

  // 初回ロード
  useEffect(() => {
    const initialFilters = loadFiltersFromURL();
    setFilters(initialFilters);
    loadTrades(initialFilters);
  }, [loadFiltersFromURL, loadTrades]);

  // フィルター変更ハンドラー
  const handleFilterSubmit = useCallback((newFilters: TradeFilterRuntime) => {
    setFilters(newFilters);
    updateURLQuery(newFilters);
    loadTrades(newFilters);
  }, [updateURLQuery, loadTrades]);

  // フィルターがアクティブかどうかチェック
  const hasActiveFilters = useCallback((filters: TradeFilterRuntime): boolean => {
    return !!(
      filters.from ||
      filters.to ||
      filters.q ||
      (filters.type && filters.type !== 'all')
    );
  }, []);

  // トレード一覧の表示
  const renderTradeItem = (trade: TradeListItem) => {
    const entryDate = new Date(trade.entry_at).toLocaleDateString('ja-JP');
    const exitDate = trade.exit_at ? new Date(trade.exit_at).toLocaleDateString('ja-JP') : '-';
    const pnlColor = trade.pnl && trade.pnl > 0 ? 'text-green-600' : trade.pnl && trade.pnl < 0 ? 'text-red-600' : 'text-gray-600';

    return (
      <div key={trade.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg">{trade.symbol}</h3>
            <p className="text-gray-600 text-sm">{trade.symbol_name}</p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              trade.side === 'long' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
            }`}>
              {trade.side === 'long' ? 'ロング' : 'ショート'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">エントリー:</span>
            <div>{entryDate}</div>
            <div>¥{trade.entry_price.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-gray-500">エグジット:</span>
            <div>{exitDate}</div>
            <div>{trade.exit_price ? `¥${trade.exit_price.toLocaleString()}` : '-'}</div>
          </div>
        </div>
        
        {trade.pnl !== null && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className={`text-right font-semibold ${pnlColor}`}>
              {trade.pnl > 0 ? '+' : ''}¥{trade.pnl.toLocaleString()}
              {trade.pnl_pct && (
                <span className="ml-2 text-sm">
                  ({trade.pnl_pct > 0 ? '+' : ''}{trade.pnl_pct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">トレードジャーナル</h1>
          {meta && (
            <p className="text-gray-600 mt-1">
              {meta.total}件のトレード記録
            </p>
          )}
        </div>
        
        <FilterButton
          hasActive={hasActiveFilters(filters)}
          onOpen={() => setShowFilterDialog(true)}
        />
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 適用中フィルター表示 */}
      {hasActiveFilters(filters) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-700 font-medium">適用中のフィルター:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.type && filters.type !== 'all' && (
              <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                結果: {filters.type === 'profit' ? '利確' : '損切り'}
              </span>
            )}
            {filters.q && (
              <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                検索: {filters.q}
              </span>
            )}
            {(filters.from || filters.to) && (
              <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                期間: {filters.from ? formatDateToISO(filters.from) : '開始日不明'} 〜 {filters.to ? formatDateToISO(filters.to) : '終了日不明'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ローディング状態 */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* トレード一覧 */}
      {!loading && trades.length > 0 && (
        <div className="grid gap-4">
          {trades.map(renderTradeItem)}
        </div>
      )}

      {/* 空状態 */}
      {!loading && trades.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            {hasActiveFilters(filters) ? 'フィルター条件に一致するトレードが見つかりません' : 'トレード記録がありません'}
          </div>
        </div>
      )}

      {/* ページネーション（基本実装） */}
      {meta && meta.has_next && (
        <div className="mt-8 text-center">
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            さらに読み込む
          </button>
        </div>
      )}

      {/* フィルターダイアログ */}
      <FilterDialog
        open={showFilterDialog}
        onOpenChange={setShowFilterDialog}
        value={filters}
        onSubmit={handleFilterSubmit}
      />
    </div>
  );
};