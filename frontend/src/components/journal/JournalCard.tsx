import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { JournalEntry } from '../../services/journal';
import { useSymbolSuggest } from '../../hooks/useSymbolSuggest';

interface JournalCardProps {
  entry: JournalEntry;
  onClick: () => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({ entry, onClick }) => {
  const isProfit = entry.pnl_abs > 0;
  const { findByCode } = useSymbolSuggest();
  const symbolInfo = findByCode(entry.symbol);
  const symbolName = symbolInfo?.name || '';
  
  return (
    <div 
      className="bg-white border border-[var(--grey-200)] rounded-xl p-6 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="font-medium text-[var(--text-primary)]">{entry.symbol} {symbolName}</span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            entry.side === 'LONG' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {entry.side === 'LONG' ? 'ロング' : 'ショート'}
          </span>
        </div>
        <span className="text-sm text-[var(--grey-500)]">
          {new Date(entry.closed_at).toLocaleDateString('ja-JP')}
        </span>
      </div>

      {/* Trade Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <span className="text-[var(--grey-500)] block">平均建値</span>
          <span className="font-medium">{entry.avg_entry.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-[var(--grey-500)] block">平均決済</span>
          <span className="font-medium">{entry.avg_exit.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-[var(--grey-500)] block">数量</span>
          <span className="font-medium">{entry.qty.toLocaleString()}株</span>
        </div>
      </div>

      {/* Analysis (if available) */}
      {entry.analysis_score !== undefined && entry.analysis_labels && (
        <div className="mb-4 p-3 bg-[var(--grey-50)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">AI解析</span>
            <span className="text-xs text-[var(--grey-500)]">
              スコア: {entry.analysis_score}/100
            </span>
          </div>
          <div className="flex gap-1">
            {entry.analysis_labels.slice(0, 3).map((label, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-white rounded border">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}


      {/* P&L */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--grey-200)]">
        <div className="flex items-center gap-2">
          {isProfit ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={`font-medium ${
            isProfit ? 'text-green-600' : 'text-red-600'
          }`}>
            {isProfit ? '+' : ''}{entry.pnl_abs.toLocaleString()}円
          </span>
        </div>
        <span className={`text-sm ${
          isProfit ? 'text-green-600' : 'text-red-600'
        }`}>
          {isProfit ? '+' : ''}{entry.pnl_pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

function formatHoldDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間`;
  return `${Math.floor(minutes / 1440)}日`;
}