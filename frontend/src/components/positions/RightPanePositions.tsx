import React, { useEffect, useState } from 'react';
import { getGroups, subscribe, makePositionKey } from '../../store/positions';
import type { Position } from '../../store/positions';
import { formatLSHeader } from '../../lib/validation';
import { useSymbolSuggest } from '../../hooks/useSymbolSuggest';
import { 
  calculatePositionMetrics, 
  formatPrice, 
  formatQty, 
  type PositionMetrics,
} from '../../utils/positionCalculations';
import { ToastContainer } from '../UI/Toast';

interface PositionCardProps {
  p: Position;
  chatId?: string | null;
  isUpdating?: boolean;
}

const PositionCard: React.FC<PositionCardProps> = ({ p, chatId, isUpdating = false }) => {
  // 取引プラン設定（Botのロジックに合わせる）
  const riskSettings = {
    stopLossPercent: 0.02,      // -2%
    profitTargetPercent: 0.05,  // +5%
  } as const;
  const [positionMetrics, setPositionMetrics] = useState<PositionMetrics>(() => 
    calculatePositionMetrics(p, undefined, riskSettings)
  );

  const handleSettleClick = () => {
    window.dispatchEvent(new CustomEvent('open-settle-from-card', { detail: { symbol: p.symbol, side: p.side, maxQty: p.qtyTotal, chatId: chatId } }));
  };

  // Positionメトリクス更新
  useEffect(() => {
    const newMetrics = calculatePositionMetrics(p, undefined, riskSettings);
    setPositionMetrics(newMetrics);
  }, [p.avgPrice, p.qtyTotal, p.side, p.version]);
  
  // 色とボーダーをサイドに応じて設定
  const borderColor = p.side === 'LONG' ? 'border-emerald-200' : 'border-red-200';
  const labelBgColor = p.side === 'LONG' ? 'bg-emerald-100' : 'bg-red-100';
  const labelTextColor = p.side === 'LONG' ? 'text-emerald-600' : 'text-red-600';
  
  // 含み損益は非表示（pnlDisplay等は未使用）
  
  return (
    <div
      className={`relative rounded-xl border-2 ${borderColor} bg-white p-4`}
      style={{ boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.09)' }}
    >
      {isUpdating && (
        <div
          className="absolute inset-0 z-10 rounded-xl bg-white/80 backdrop-blur-sm"
          data-testid="position-card-skeleton"
        >
          <div className="flex h-full flex-col justify-between gap-4 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-6 w-20 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
              </div>
              <div className="flex gap-3">
                <div className="h-7 w-28 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-7 w-28 rounded-full bg-gray-200 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
            </div>
            <div className="h-9 w-full rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      )}

      <div className={isUpdating ? 'opacity-0 pointer-events-none' : ''}>
        <div className="flex items-center justify-between mb-4">
          <div className={`px-4 py-1 rounded-full text-sm font-medium ${labelBgColor} ${labelTextColor} min-w-[80px] text-center`}>
            {p.side}
          </div>
          <div className="flex items-center">
            <div 
              className="text-sm text-gray-500"
              data-testid="position-updated-at"
            >
              更新 {new Date(p.updatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      
      <div className="flex gap-3 mb-4">
        <div 
          className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300 whitespace-nowrap"
          data-testid="position-qty"
        >
          保有 {formatQty(p.qtyTotal)}
        </div>
        <div 
          className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300 whitespace-nowrap"
          data-testid="position-avg-price"
        >
          平均建値 {formatPrice(p.avgPrice)}
        </div>
      </div>
      
      {/* Position Metrics */}
      <div 
        className="mb-4 space-y-1"
        data-testid="position-metrics"
      >
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            {`利確目標+${(riskSettings.profitTargetPercent * 100).toFixed(0)}%:`}
          </span>
          <span className="text-green-600" data-testid="position-tp">
            ¥{new Intl.NumberFormat('ja-JP').format(Math.round(positionMetrics.profitTarget))}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            {`損切り目標 -${(riskSettings.stopLossPercent * 100).toFixed(0)}%:`}
          </span>
          <span className="text-red-600" data-testid="position-sl">
            ¥{new Intl.NumberFormat('ja-JP').format(Math.round(positionMetrics.stopLossTarget))}
          </span>
        </div>
      </div>
      
      <div className="mt-5">
        <button 
          onClick={handleSettleClick} 
          className="w-full bg-red-600 text-white text-base font-medium py-2 rounded-full hover:bg-red-700 transition-colors"
        >
          約定入力
        </button>
      </div>
      </div>
    </div>
  );
};

interface RightPanePositionsProps {
  chatId?: string | null;
}

const RightPanePositions: React.FC<RightPanePositionsProps> = ({ chatId }) => {
  // 銘柄情報取得のためのhook
  const { findByCode } = useSymbolSuggest();
  
  // chatIdがnullまたはundefinedの場合は空のポジションを表示
  const [groups, setGroups] = useState(() => {
    return chatId ? getGroups(chatId) : [];
  });
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    // chatIdが変更されたらポジションを更新
    const result = chatId ? getGroups(chatId) : [];
    setGroups(result);
    
    const unsub = subscribe(() => {
      const updated = chatId ? getGroups(chatId) : [];
      setGroups(updated);
    });
    // 明示イベントでも再取得（削除後の即時反映を補助）
    const onPositionsChanged = () => {
      const updated = chatId ? getGroups(chatId) : [];
      setGroups(updated);
    };
    window.addEventListener('positions-changed', onPositionsChanged);
    return () => {
      unsub();
      window.removeEventListener('positions-changed', onPositionsChanged);
    };
  }, [chatId]);

  useEffect(() => {
    if (loadingKeys.size === 0) {
      return;
    }

    const activeKeys = new Set<string>();
    groups.forEach(group => {
      group.positions.forEach(position => {
        activeKeys.add(makePositionKey(position.symbol, position.side, position.chatId ?? chatId ?? null));
      });
    });

    setLoadingKeys(prev => {
      if (prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Set<string>();
      prev.forEach(key => {
        if (activeKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [groups, chatId]);

  useEffect(() => {
    const resolveKeyFromDetail = (detail: any): string | null => {
      if (!detail) return null;
      if (detail.position) {
        const pos = detail.position as Position;
        return makePositionKey(pos.symbol, pos.side, (pos as Position).chatId ?? detail.chatId ?? null);
      }
      if (!detail.symbol || !detail.side) return null;
      return makePositionKey(detail.symbol, detail.side, detail.chatId ?? null);
    };

    const handleStart = (event: Event) => {
      const custom = event as CustomEvent;
      const key = resolveKeyFromDetail(custom.detail);
      if (!key) return;
      setLoadingKeys((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    };

    const handleFinish = (event: Event) => {
      const custom = event as CustomEvent;
      const key = resolveKeyFromDetail(custom.detail);
      if (!key) return;
      setLoadingKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    window.addEventListener('position-update-start', handleStart as EventListener);
    window.addEventListener('position-update-complete', handleFinish as EventListener);
    window.addEventListener('position-update-error', handleFinish as EventListener);

    return () => {
      window.removeEventListener('position-update-start', handleStart as EventListener);
      window.removeEventListener('position-update-complete', handleFinish as EventListener);
      window.removeEventListener('position-update-error', handleFinish as EventListener);
    };
  }, []);

  // chatIdがnullの場合はポジションを表示しない
  if (!chatId || groups.length === 0) {
    const message = !chatId ? 
      'チャットを選択してください' : 
      'ポジションはまだありません';
    
    return (
      <div className="h-full p-4">
        <h2 className="text-[16px] font-semibold text-[#1F2937] mb-4">オープンポジション</h2>
        <div className="text-xs text-[#6B7280]">{message}</div>
        {!chatId && (
          <div className="text-xs text-[#DC2626] mt-2">⚠️ チャットID: {String(chatId)}</div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="h-full p-4 space-y-4">
        <h2 className="text-[16px] font-semibold text-[#1F2937]">オープンポジション</h2>
        {groups.map((g) => {
          const long = g.positions.find(p => p.side === 'LONG')?.qtyTotal ?? 0;
          const short = g.positions.find(p => p.side === 'SHORT')?.qtyTotal ?? 0;
          const header = formatLSHeader(long, short);
          // グループ表示用の銘柄情報を取得
          const groupSymbolInfo = findByCode(g.symbol);
          const groupDisplayName = groupSymbolInfo ? `${g.symbol} ${groupSymbolInfo.name}` : g.symbol;
          
          return (
            <div key={g.symbol} className="rounded-xl bg-white shadow-sm p-4">
              {/* 上部の銘柄情報 */}
              <div className="space-y-4">
                <div className="text-sm text-gray-600 font-medium">
                  {header}
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {g.symbol} {groupSymbolInfo?.name || ''}
                </div>
              </div>
              
              {/* ポジション部分 */}
              <div className="space-y-4 mt-2">
                {g.positions
                  .filter(p => p.side === 'SHORT')
                  .map(p => {
                    const cardKey = makePositionKey(p.symbol, p.side, p.chatId ?? chatId ?? null);
                    return (
                      <PositionCard
                        key={`${p.symbol}:SHORT:${p.chatId}`}
                        p={p}
                        chatId={chatId}
                        isUpdating={loadingKeys.has(cardKey)}
                      />
                    );
                  })}
                {g.positions
                  .filter(p => p.side === 'LONG')
                  .map(p => {
                    const cardKey = makePositionKey(p.symbol, p.side, p.chatId ?? chatId ?? null);
                    return (
                      <PositionCard
                        key={`${p.symbol}:LONG:${p.chatId}`}
                        p={p}
                        chatId={chatId}
                        isUpdating={loadingKeys.has(cardKey)}
                      />
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Toast Container for Bot/AI failure notifications */}
      <ToastContainer position="top-right" maxToasts={3} />
    </>
  );
};

export default RightPanePositions;

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
