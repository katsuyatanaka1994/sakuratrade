import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calendar, Search, ChevronDown } from 'lucide-react';

type TradeStatus = 'open' | 'closed';

type DummyTradeRecord = {
  id: string;
  symbol: string;
  name: string;
  side: 'ロング' | 'ショート';
  entryPrice: number;
  pnl: number;
  pnlPercent: number;
  status: TradeStatus;
  recordedAt: string;
  pattern: string;
};

const dummyTrades: DummyTradeRecord[] = [
  {
    id: 't1',
    symbol: '9991',
    name: '任天堂',
    side: 'ショート',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'closed',
    recordedAt: '2025-09-13',
    pattern: '戻り売り',
  },
  {
    id: 't2',
    symbol: '9990',
    name: 'ソニー',
    side: 'ショート',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'closed',
    recordedAt: '2025-09-10',
    pattern: '戻り売り',
  },
  {
    id: 't3',
    symbol: '9889',
    name: 'KDDI',
    side: 'ショート',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'closed',
    recordedAt: '2025-09-11',
    pattern: '押し目買い',
  },
  {
    id: 't4',
    symbol: '9988',
    name: 'NTTドコモ',
    side: 'ショート',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'closed',
    recordedAt: '2025-09-08',
    pattern: '押し目買い',
  },
  {
    id: 't5',
    symbol: '9987',
    name: 'Zホールディングス',
    side: 'ショート',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'closed',
    recordedAt: '2025-09-09',
    pattern: '戻り売り',
  },
  {
    id: 't6',
    symbol: '9986',
    name: 'ヤフー',
    side: 'ロング',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'open',
    recordedAt: '2025-09-08',
    pattern: '押し目買い',
  },
  {
    id: 't7',
    symbol: '7203',
    name: 'トヨタ自動車',
    side: 'ロング',
    entryPrice: 170000,
    pnl: 17000,
    pnlPercent: 1.35,
    status: 'closed',
    recordedAt: '2025-09-07',
    pattern: 'ブレイク',
  },
  {
    id: 't8',
    symbol: '9985',
    name: '楽天',
    side: 'ショート',
    entryPrice: 175000,
    pnl: -15000,
    pnlPercent: -2.35,
    status: 'closed',
    recordedAt: '2025-09-06',
    pattern: '戻り売り',
  },
  {
    id: 't9',
    symbol: '9984',
    name: 'ソフトバンクG',
    side: 'ロング',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'open',
    recordedAt: '2025-09-05',
    pattern: '押し目買い',
  },
  {
    id: 't10',
    symbol: '9984',
    name: 'ソフトバンクG',
    side: 'ショート',
    entryPrice: 175000,
    pnl: 175000,
    pnlPercent: 4.35,
    status: 'closed',
    recordedAt: '2025-09-04',
    pattern: '戻り売り',
  },
];

const formatCurrency = (value: number) => `¥${Math.abs(value).toLocaleString('ja-JP')}`;

const formatPercentText = (value: number) => {
  if (value > 0) return `+${Math.abs(value).toFixed(2)}%`;
  if (value < 0) return `-${Math.abs(value).toFixed(2)}%`;
  return '0%';
};

const formatSignedCurrency = (value: number) => {
  if (value > 0) return `+${formatCurrency(value)}`;
  if (value < 0) return `-${formatCurrency(value)}`;
  return formatCurrency(value);
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('ja-JP');
};

const pnlColor = (value: number) => {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-500';
};

type AiFeedbackTone = 'positive' | 'warning' | 'action';

type AiFeedbackItem = {
  id: string;
  title: string;
  description: string;
  tone: AiFeedbackTone;
};

type TradePlan = {
  profitTarget: number;
  profitPercent: number;
  profitNote: string;
  lossTarget: number;
  lossPercent: number;
  lossNote: string;
  rrRatio: string;
};

type TradeTimelineEntryType = 'entry' | 'fill' | 'exit';

type TradeTimelineEntry = {
  id: string;
  type: TradeTimelineEntryType;
  label: string;
  price: number;
  quantity: number;
  note: string;
  date: string;
  pnlChange?: number;
  pnlPercentChange?: number;
};

type TradeDetail = {
  realizedPnl: number;
  realizedPnlPercent: number;
  aiFeedback: AiFeedbackItem[];
  plan: TradePlan;
  timeline: TradeTimelineEntry[];
};

const aiFeedbackToneClasses: Record<AiFeedbackTone, string> = {
  positive: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  action: 'border-sky-100 bg-sky-50 text-sky-700',
};

const aiFeedbackToneIcons: Record<AiFeedbackTone, string> = {
  positive: '✅',
  warning: '⚠️',
  action: '💡',
};

const timelineDotClasses: Record<TradeTimelineEntryType, string> = {
  entry: 'bg-emerald-500',
  fill: 'bg-blue-500',
  exit: 'bg-rose-500',
};

const timelineLabelClasses: Record<TradeTimelineEntryType, string> = {
  entry: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  fill: 'border-blue-200 bg-blue-50 text-blue-700',
  exit: 'border-rose-200 bg-rose-50 text-rose-700',
};

const createTradeDetail = (trade?: DummyTradeRecord): TradeDetail => ({
  realizedPnl: trade?.pnl ?? 17000,
  realizedPnlPercent: trade?.pnlPercent ?? 1.35,
  aiFeedback: [
    { id: 'good', title: '良かった点', description: 'テキスト', tone: 'positive' },
    { id: 'improve', title: '改善点', description: 'テキスト', tone: 'warning' },
    { id: 'next', title: '次のアクション', description: 'テキスト', tone: 'action' },
  ],
  plan: {
    profitTarget: 7963,
    profitPercent: 4,
    profitNote: '想定損益: ¥30,652',
    lossTarget: 7510,
    lossPercent: -2,
    lossNote: '想定損益: -¥15,326',
    rrRatio: '1:2',
  },
  timeline: [
    {
      id: 'entry-stage',
      type: 'entry',
      label: '建値',
      price: trade?.entryPrice ?? 7663,
      quantity: 200,
      note: '5上突破でエントリー',
      date: '2025/9/7',
    },
    {
      id: 'fill-1',
      type: 'fill',
      label: '約定 (1回目)',
      price: 7863,
      quantity: 100,
      note: '5上突破でエントリー',
      date: '2025/9/8',
      pnlChange: 7000,
      pnlPercentChange: 1.8,
    },
    {
      id: 'fill-2',
      type: 'fill',
      label: '約定 (2回目)',
      price: 7963,
      quantity: 100,
      note: '5上突破でエントリー',
      date: '2025/9/9',
      pnlChange: 7000,
      pnlPercentChange: 1.8,
    },
  ],
});

const fallbackTradeDetail = createTradeDetail();

const tradeDetails: Record<string, TradeDetail> = Object.fromEntries(
  dummyTrades.map((trade) => [trade.id, createTradeDetail(trade)])
);

const TradeRecordsPage: React.FC = () => {
  const [selectedTradeId, setSelectedTradeId] = useState(dummyTrades[0]?.id ?? '');
  const [resultFilter, setResultFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [positionTypeFilter, setPositionTypeFilter] = useState<'all' | 'long' | 'short'>('all');
  const [patternFilter, setPatternFilter] = useState<string>('押し目買い');

  const selectedTrade = useMemo(
    () => dummyTrades.find((trade) => trade.id === selectedTradeId) ?? dummyTrades[0],
    [selectedTradeId],
  );
  const detail = selectedTrade ? tradeDetails[selectedTrade.id] ?? fallbackTradeDetail : fallbackTradeDetail;

  return (
    <div className="p-6">
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-end gap-6 overflow-x-auto">
          <div className="flex min-w-[240px] flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">日付</span>
            <label className="relative flex h-10 w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus-within:border-[#5ED0E8] focus-within:ring-2 focus-within:ring-[#5ED0E8]/20">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="2025/08/01 - 2025/08/31"
                className="w-full border-none bg-transparent p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
                aria-label="日付範囲"
              />
            </label>
          </div>

          <div className="flex min-w-[240px] flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">銘柄検索</span>
            <label className="relative flex h-10 w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus-within:border-[#5ED0E8] focus-within:ring-2 focus-within:ring-[#5ED0E8]/20">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="コードまたは銘柄名を入力"
                className="w-full border-none bg-transparent p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
                aria-label="銘柄検索"
              />
            </label>
          </div>

          <div className="flex min-w-[264px] flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">トレード結果</span>
            <div className="flex h-11 items-center rounded-full border border-gray-200 bg-gray-100 p-1">
              {[{ key: 'all', label: 'すべて' }, { key: 'profit', label: '利確' }, { key: 'loss', label: '損切り' }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setResultFilter(key as typeof resultFilter)}
                  className={clsx(
                    'flex-1 h-full rounded-full px-4 text-sm font-medium transition',
                    resultFilter === key
                      ? 'bg-white text-[#1186A5] shadow'
                      : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-[290px] flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">ポジションタイプ</span>
            <div className="flex h-11 items-center rounded-full border border-gray-200 bg-gray-100 p-1">
              {[{ key: 'all', label: 'すべて' }, { key: 'long', label: 'ロング' }, { key: 'short', label: 'ショート' }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPositionTypeFilter(key as typeof positionTypeFilter)}
                  className={clsx(
                    'flex-1 h-full rounded-full px-4 text-sm font-medium transition',
                    positionTypeFilter === key
                      ? 'bg-white text-[#1186A5] shadow'
                      : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-[180px] flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">パターン</span>
            <button
              type="button"
              className="flex h-10 items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:border-gray-400"
            >
              <span>{patternFilter}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="flex min-w-[72px] justify-end">
            <button
              type="button"
              className="text-sm font-medium text-[#1186A5] hover:underline"
              onClick={() => {
                setResultFilter('all');
                setPositionTypeFilter('all');
                setPatternFilter('押し目買い');
              }}
            >
              リセット
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[520px_minmax(0,1fr)]">
        <section className="flex h-full max-h-[calc(100vh-200px)] flex-col gap-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 lg:min-w-[520px]">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>トレード一覧</span>
            <span>{dummyTrades.length}件</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-0">
            {dummyTrades.map((trade) => {
              const isSelected = selectedTrade?.id === trade.id;
              return (
                <button
                  key={trade.id}
                  type="button"
                  onClick={() => setSelectedTradeId(trade.id)}
                  className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5ED0E8]"
                >
                  <div
                    data-testid="trade-card"
                    className={clsx(
                      'flex w-full min-w-[467px] flex-col rounded-md border border-gray-200 bg-white p-4 transition-shadow',
                      isSelected ? 'border-[#5ED0E8] bg-[#F0FBFE] shadow-md' : 'hover:border-gray-300 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-[20px] font-medium text-gray-900">
                        {trade.symbol} {trade.name}
                      </div>
                      <div className="text-[14px] font-medium text-gray-500">
                        全約定日: {formatDate(trade.recordedAt)}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-3 py-1 text-sm',
                            trade.side === 'ロング'
                              ? 'border-green-300 text-green-600'
                              : 'border-red-300 text-red-600'
                          )}
                        >
                          {trade.side}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600">
                          {trade.pattern}
                        </span>
                      </div>
                      <div className="text-right font-bold">
                        <span className={clsx('text-[24px]', pnlColor(trade.pnl))}>
                          {trade.pnl > 0 ? '+' : trade.pnl < 0 ? '-' : ''}
                          {formatCurrency(trade.pnl)}
                        </span>
                        <span className={clsx('ml-1 text-[14px] font-bold', pnlColor(trade.pnl))}>
                          ({formatPercentText(trade.pnlPercent)})
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex h-full max-h-[calc(100vh-160px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {selectedTrade ? (
            <div className="flex h-full flex-col">
              <div
                data-testid="detail-header"
                className="grid grid-cols-[1fr_auto] items-center border-b border-gray-200 bg-white px-4 py-6"
              >
                <div data-testid="header-left" className="flex flex-col">
                  <h1 data-testid="header-title" className="text-[24px] font-bold text-gray-900">
                    {selectedTrade.symbol} {selectedTrade.name}
                  </h1>
                  <div data-testid="header-date" className="mt-1 text-[12px] font-semibold text-gray-600">
                    全約定日: {formatDate(selectedTrade.recordedAt)}
                  </div>
                  <div data-testid="header-chips" className="mt-3 flex items-center gap-2">
                    <span
                      data-testid="chip-position"
                      className={clsx(
                        'inline-flex items-center justify-center rounded-full border px-3 py-1 text-sm',
                        selectedTrade.side === 'ロング'
                          ? 'border-green-300 text-green-600'
                          : 'border-red-300 text-red-600'
                      )}
                    >
                      {selectedTrade.side}
                    </span>
                    <span
                      data-testid="chip-pattern"
                      className="inline-flex items-center justify-center rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600"
                    >
                      {selectedTrade.pattern}
                    </span>
                  </div>
                </div>
                <div data-testid="header-pnl" className="flex items-baseline justify-end gap-2 text-right">
                  <span data-testid="header-pnl-label" className="text-[14px] font-bold text-gray-800 leading-none">
                    実現損益
                  </span>
                  <span
                    data-testid="header-pnl-amount"
                    className={clsx('text-[32px] font-bold leading-[0.75]', pnlColor(detail.realizedPnl))}
                  >
                    {formatSignedCurrency(detail.realizedPnl)}
                  </span>
                  <span
                    data-testid="header-pnl-rate"
                    className={clsx('text-[12px] font-bold leading-[0.75]', pnlColor(detail.realizedPnl))}
                  >
                    ({formatPercentText(detail.realizedPnlPercent)})
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <section
                  data-testid="ai-feedback"
                  className="mt-6 mb-4 flex flex-col gap-4 rounded-md border border-indigo-100 bg-indigo-50/60 p-4"
                >
                  <div className="flex items-center gap-2 px-1">
                    <span role="img" aria-hidden="true" className="text-pink-500">
                      🧠
                    </span>
                    <span className="text-[16px] font-bold text-gray-800">AIフィードバック</span>
                  </div>
                  <div
                    data-testid="ai-feedback-grid"
                    className="grid grid-cols-1 gap-4 md:grid-cols-3"
                  >
                    {detail.aiFeedback.map((item) => (
                      <article
                        key={item.id}
                        data-testid={`ai-card-${item.id}`}
                        className="flex h-[112px] flex-col gap-2 rounded-md bg-white p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              {
                                good: 'text-green-600',
                                improve: 'text-amber-500',
                                next: 'text-blue-600',
                              }[item.id as 'good' | 'improve' | 'next']
                            )}
                          >
                            {aiFeedbackToneIcons[item.tone]}
                          </span>
                          <span
                            className={clsx(
                              'font-bold',
                              item.id === 'good' && 'text-[14px] text-green-600',
                              item.id === 'improve' && 'text-[14px] text-amber-600',
                              item.id === 'next' && 'text-[16px] text-blue-600'
                            )}
                          >
                            {item.title}
                          </span>
                        </div>
                        <ul className="list-disc pl-5 text-[14px] leading-6 text-gray-700">
                          <li>{item.description}</li>
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>

                <section
                  data-testid="trade-plan"
                  className="mt-6 flex w-full flex-col items-start gap-2 rounded-md border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <h3 className="mb-2 text-[16px] font-bold text-gray-800">トレード計画</h3>
                  <div className="grid w-full gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>利確目標</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {formatPercentText(detail.plan.profitPercent)}
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {formatCurrency(detail.plan.profitTarget)}
                    </div>
                    <div className="mt-2 text-xs text-emerald-600">{detail.plan.profitNote}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>損切り目標</span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        {formatPercentText(detail.plan.lossPercent)}
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {formatCurrency(detail.plan.lossTarget)}
                    </div>
                    <div className="mt-2 text-xs text-rose-600">{detail.plan.lossNote}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-sm text-gray-500">RR比</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{detail.plan.rrRatio}</div>
                    <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                      <div className="h-full w-2/3 rounded-full bg-emerald-500" />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-gray-500">
                      <span>Risk</span>
                      <span>Reward</span>
                    </div>
                  </div>
                </div>
                </section>

                <section
                  data-testid="executions"
                  className="relative mt-6 flex flex-col gap-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <h3 className="text-[16px] font-bold text-gray-800">取引内容</h3>
                  <div
                    data-testid="tl-rail"
                    className="pointer-events-none absolute left-[28px] top-6 bottom-6 w-px bg-gray-200"
                    aria-hidden
                  />
                  <div data-testid="exec-list" className="flex flex-col gap-6">
                    {detail.timeline.map((entry, index) => (
                      <article
                        key={entry.id}
                        data-testid={`exec-item-${index}`}
                        className="relative grid grid-cols-[24px_1fr_auto] items-start gap-x-3 gap-y-2"
                      >
                        <div className="flex items-center justify-center">
                          <span
                            data-testid={`tl-dot-${index}`}
                            className={clsx(
                              'h-4 w-4 flex-shrink-0 rounded-full shadow-[0_0_0_2px_#FFF]',
                              entry.type === 'entry' ? 'bg-green-300' : 'bg-gray-400'
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[14px] font-semibold text-gray-700">{entry.label}</span>
                          <div className="mt-1 flex items-baseline text-gray-900">
                            <span className="text-[20px] font-extrabold">{formatCurrency(entry.price)}</span>
                            {typeof entry.pnlChange === 'number' && (
                              <span className={clsx('ml-2 text-[12px] font-bold', pnlColor(entry.pnlChange))}>
                                {formatSignedCurrency(entry.pnlChange)}
                                {typeof entry.pnlPercentChange === 'number' && (
                                  <span className="ml-1 text-[12px] font-medium">{formatPercentText(entry.pnlPercentChange)}</span>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[12px] text-gray-500">
                            数量 {entry.quantity.toLocaleString('ja-JP')}株
                          </div>
                          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[14px] text-gray-700">
                            {entry.note}
                          </div>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <span className="mb-1 text-[12px] text-gray-500">{entry.date}</span>
                          <div
                            data-testid={`exec-thumb-${index}`}
                            className="h-[60px] w-[60px] overflow-hidden rounded-md border border-gray-200"
                          >
                            <img
                              src="https://via.placeholder.com/60"
                              alt="チャート"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              トレードを選択すると詳細がこちらに表示されます。
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TradeRecordsPage;
