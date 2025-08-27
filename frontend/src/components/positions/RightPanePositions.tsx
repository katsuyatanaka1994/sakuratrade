import React, { useEffect, useState } from 'react';
import { getGroups, subscribe } from '../../store/positions';
import type { Position } from '../../store/positions';
import { formatLSHeader } from '../../lib/validation';
import { useSymbolSuggest } from '../../hooks/useSymbolSuggest';

const Badge: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
    <span className="opacity-70">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const PositionCard: React.FC<{ p: Position; chatId?: string | null; findByCode: (code: string) => any }> = ({ p, chatId, findByCode }) => {
  const handleSettleClick = () => {
    window.dispatchEvent(new CustomEvent('open-settle-from-card', { detail: { symbol: p.symbol, side: p.side, maxQty: p.qtyTotal, chatId: chatId } }));
  };
  
  // 色とボーダーをサイドに応じて設定
  const borderColor = p.side === 'LONG' ? 'border-emerald-200' : 'border-red-200';
  const labelBgColor = p.side === 'LONG' ? 'bg-emerald-100' : 'bg-red-100';
  const labelTextColor = p.side === 'LONG' ? 'text-emerald-600' : 'text-red-600';
  
  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-white p-4`} style={{boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.09)'}}>
      <div className="flex items-center justify-between mb-4">
        <div className={`px-4 py-1 rounded-full text-sm font-medium ${labelBgColor} ${labelTextColor} min-w-[80px] text-center`}>
          {p.side}
        </div>
        <div className="text-sm text-gray-500">
          更新 {new Date(p.updatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      
      <div className="flex gap-3 mb-4">
        <div className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300">
          保有 {p.qtyTotal}株
        </div>
        <div className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300">
          平均建値 ¥{new Intl.NumberFormat('ja-JP').format(p.avgPrice)}
        </div>
      </div>
      
      <div className="mt-5">
        <button 
          onClick={handleSettleClick} 
          className="w-full bg-red-600 text-white text-base font-medium py-2 rounded-full hover:bg-red-700 transition-colors"
        >
          決済入力
        </button>
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

  useEffect(() => {
    // chatIdが変更されたらポジションを更新
    const result = chatId ? getGroups(chatId) : [];
    setGroups(result);
    
    const unsub = subscribe(() => {
      const updated = chatId ? getGroups(chatId) : [];
      setGroups(updated);
    });
    return () => unsub();
  }, [chatId]);

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
              {g.positions.filter(p => p.side === 'SHORT').map(p => <PositionCard key={`${p.symbol}:SHORT:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} />)}
              {g.positions.filter(p => p.side === 'LONG').map(p => <PositionCard key={`${p.symbol}:LONG:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RightPanePositions;