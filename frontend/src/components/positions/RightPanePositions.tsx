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
  const sideColor = p.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300' : 'bg-rose-500/10 text-rose-700 border-rose-300';
  const sideChip = p.side;
  const handleSettleClick = () => {
    window.dispatchEvent(new CustomEvent('open-settle-from-card', { detail: { symbol: p.symbol, side: p.side, maxQty: p.qtyTotal, chatId: chatId } }));
  };
  
  // 銘柄コードから銘柄情報を取得
  const symbolInfo = findByCode(p.symbol);
  const displayName = symbolInfo ? `${p.symbol} ${symbolInfo.name}` : p.name ?? p.symbol;
  return (
    <div className={`rounded-2xl border ${p.side === 'LONG' ? 'border-emerald-200' : 'border-rose-200'} bg-white shadow-sm`}>
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          <div className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sideColor} border`}>{sideChip}</div>
          <div className="text-sm text-zinc-500">{p.symbol}</div>
        </div>
        <div className="text-[11px] text-zinc-400">更新 {new Date(p.updatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div className="px-4 pb-3 pt-2">
        <div className="mb-2 text-base font-medium">{displayName}</div>
        <div className="flex flex-wrap gap-2">
          <Badge label="保有" value={`${p.qtyTotal}株`} />
          <Badge label="平均建値" value={`¥${new Intl.NumberFormat('ja-JP').format(p.avgPrice)}`} />
        </div>
        <div className="mt-3">
          <button onClick={handleSettleClick} className="w-full rounded-full bg-red-600 px-6 py-2 text-xs text-white hover:bg-red-700">決済入力</button>
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
          <div key={g.symbol} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <div className="text-sm text-zinc-500">{g.symbol}</div>
                <div className="text-lg font-semibold">{groupDisplayName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-zinc-700">{header}</div>
              </div>
            </div>
            <div className="grid gap-3">
              {g.positions.filter(p => p.side === 'LONG').map(p => <PositionCard key={`${p.symbol}:LONG:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} />)}
              {g.positions.filter(p => p.side === 'SHORT').map(p => <PositionCard key={`${p.symbol}:SHORT:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RightPanePositions;