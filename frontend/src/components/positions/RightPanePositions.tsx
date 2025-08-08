import React, { useEffect, useState } from 'react';
import { getGroups, subscribe, Position } from '@/store/positions';
import { formatLSHeader } from '@/lib/validation';

const Badge: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
    <span className="opacity-70">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const PositionCard: React.FC<{ p: Position }> = ({ p }) => {
  const sideColor = p.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300' : 'bg-rose-500/10 text-rose-700 border-rose-300';
  const sideChip = p.side;
  const handleSettleClick = () => {
    window.dispatchEvent(new CustomEvent('open-settle-from-card', { detail: { symbol: p.symbol, side: p.side, maxQty: p.qtyTotal } }));
  };
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
        <div className="mb-2 text-base font-medium">{p.name ?? p.symbol}</div>
        <div className="flex flex-wrap gap-2">
          <Badge label="保有" value={`${p.qtyTotal}株`} />
          <Badge label="平均建値" value={`¥${new Intl.NumberFormat('ja-JP').format(p.avgPrice)}`} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={handleSettleClick} className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white hover:opacity-90">決済入力</button>
          <button className="ml-auto rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50">詳細</button>
        </div>
      </div>
    </div>
  );
};

const RightPanePositions: React.FC = () => {
  const [groups, setGroups] = useState(getGroups());

  useEffect(() => {
    const unsub = subscribe(() => setGroups(getGroups()));
    return () => unsub();
  }, []);

  if (groups.length === 0) {
    return (
      <div className="h-full p-4">
        <div className="text-xs text-[#6B7280]">ポジションはまだありません</div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 space-y-4">
      {groups.map((g) => {
        const long = g.positions.find(p => p.side === 'LONG')?.qtyTotal ?? 0;
        const short = g.positions.find(p => p.side === 'SHORT')?.qtyTotal ?? 0;
        const header = formatLSHeader(long, short);
        return (
          <div key={g.symbol} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <div className="text-sm text-zinc-500">{g.symbol}</div>
                <div className="text-lg font-semibold">{g.symbol}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-zinc-700">{header}</div>
              </div>
            </div>
            <div className="grid gap-3">
              {g.positions.filter(p => p.side === 'LONG').map(p => <PositionCard key={`${p.symbol}:LONG`} p={p} />)}
              {g.positions.filter(p => p.side === 'SHORT').map(p => <PositionCard key={`${p.symbol}:SHORT`} p={p} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RightPanePositions;