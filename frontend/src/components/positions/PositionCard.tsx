import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../UI/card';
import { Badge } from '../UI/badge';
import { ScrollArea } from '../UI/scroll-area';
import { cn } from '../UI/utils';
import type { PositionNoteEntry } from '../../store/positions';

const numberFormatter = new Intl.NumberFormat('ja-JP');
const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) {
    return direct;
  }

  const match = trimmed.match(/^([0-9]{4})[\/-]([0-9]{1,2})[\/-]([0-9]{1,2})(?:\s+([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?)?$/);
  if (!match) return null;

  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  const numericDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  return Number.isNaN(numericDate.getTime()) ? null : numericDate.getTime();
};

const formatTimestamp = (value?: string): string | null => {
  const timestamp = parseTimestamp(value);
  if (timestamp !== null) {
    return dateTimeFormatter.format(new Date(timestamp));
  }

  if (value && value.trim()) {
    return value.trim();
  }

  return null;
};

export interface HoldingPositionCardData {
  id: string;
  symbolCode: string;
  symbolName: string;
  side: 'LONG' | 'SHORT';
  averagePrice: number;
  quantity: number;
  patterns?: string[];
  memo?: string;
  memoEntries?: PositionNoteEntry[];
  updatedAt: string;
  chatLink?: string;
}

interface PositionCardProps {
  position: HoldingPositionCardData;
  className?: string;
}

const positionSideStyles = {
  LONG: {
    badge: 'bg-[#00A86B] text-white',
    label: 'ロング',
  },
  SHORT: {
    badge: 'bg-[#E74C3C] text-white',
    label: 'ショート',
  },
} as const;

export const PositionCard: React.FC<PositionCardProps> = ({ position, className }) => {
  const {
    id,
    symbolCode,
    symbolName,
    side,
    averagePrice,
    quantity,
    patterns = [],
    memo,
    memoEntries,
    updatedAt,
    chatLink = '/trade',
  } = position;

  const formattedPrice = numberFormatter.format(Math.round(averagePrice ?? 0));
  const formattedQuantity = numberFormatter.format(Math.round(quantity ?? 0));

  const updatedDate = (() => {
    const date = new Date(updatedAt);
    return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
  })();

  const sideStyles = positionSideStyles[side] ?? positionSideStyles.LONG;

  const memoList = React.useMemo(() => {
    const collected: Array<{ text: string; updatedAt?: string }> = [];

    if (Array.isArray(memoEntries) && memoEntries.length > 0) {
      memoEntries.forEach((entry) => {
        if (!entry) return;
        const text = typeof entry.text === 'string' ? entry.text.trim() : '';
        if (!text) return;
        const updated = typeof entry.updatedAt === 'string' ? entry.updatedAt.trim() : undefined;
        collected.push({ text, updatedAt: updated });
      });
    }

    if (collected.length === 0 && typeof memo === 'string' && memo.trim().length > 0) {
      collected.push({ text: memo.trim(), updatedAt });
    }

    return collected
      .map((entry) => ({
        text: entry.text,
        updatedAt: entry.updatedAt,
        timestamp: parseTimestamp(entry.updatedAt),
      }))
      .sort((a, b) => {
        if (a.timestamp !== null && b.timestamp !== null) {
          return b.timestamp - a.timestamp;
        }
        if (a.timestamp !== null) return -1;
        if (b.timestamp !== null) return 1;
        return 0;
      })
      .map(({ text, updatedAt }) => ({ text, updatedAt }));
  }, [memoEntries, memo, updatedAt]);

  return (
    <Card
      data-testid={`position-card-${id}`}
      className={cn(
        'flex h-full flex-col gap-4 rounded-[12px] border border-[#E5E5EA] bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md',
        className,
      )}
    >
      <header className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2 text-gray-900">
          <span className="font-mono text-xs text-[#8E8E93]">{symbolCode}</span>
          <span className="text-[15px] font-semibold leading-tight">{symbolName}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className={cn('rounded-full px-[10px] py-1 text-xs font-medium tracking-tight', sideStyles.badge)}>
            {sideStyles.label}
          </Badge>
          {patterns.map((pattern) => (
            <Badge
              key={pattern}
              className="rounded-full border border-[#DADADA] bg-[#F5F5F5] px-[10px] py-1 text-xs font-medium text-[#333333]"
            >
              {pattern}
            </Badge>
          ))}
        </div>
      </header>

      <section className="space-y-4 text-sm text-[#8E8E93]">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px]">平均建値</span>
          <span className="font-mono text-[14px] font-semibold text-black">¥{formattedPrice}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[13px]">株数</span>
          <span className="font-mono text-[14px] font-semibold text-black">{formattedQuantity}株</span>
        </div>
      </section>

      <section className="flex flex-1 flex-col">
        <ScrollArea
          className="h-24 rounded-lg border border-[#E5E5EA] bg-[#F8F9FA] px-3 py-2 text-sm leading-6 text-[#333333]"
          aria-label="メモ"
        >
          {memoList.length === 0 ? (
            <span className="text-[#8E8E93]">メモはありません。</span>
          ) : (
            <div className="flex flex-col gap-2 text-[#333333]">
              {memoList.map((entry, index) => {
                const formatted = formatTimestamp(entry.updatedAt);
                return (
                  <div key={`${id}-memo-${index}`} className="flex flex-col gap-1">
                    <p className="whitespace-pre-wrap">{entry.text}</p>
                    {formatted ? (
                      <span className="text-[11px] text-[#8E8E93]">{formatted}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </section>

      <footer className="space-y-4 text-right text-xs text-[#A1A1A1]">
        <div>更新日：{updatedDate}</div>
        <div>
          <Link
            to={chatLink}
            className="inline-flex items-center gap-[6px] text-sm font-semibold text-[#007AFF] transition-colors hover:text-[#005BBB]"
            aria-label={`「${symbolCode} ${symbolName}」のチャット画面へ`}
          >
            <span className="leading-[1.2]">チャット画面へ</span>
            <span aria-hidden="true" className="text-lg leading-[1.1]">›</span>
          </Link>
        </div>
      </footer>
    </Card>
  );
};

export default PositionCard;
