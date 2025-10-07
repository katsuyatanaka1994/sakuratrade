import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, X, Settings, BarChart } from 'lucide-react';
import { Button } from './UI/button';
import { Card } from './UI/card';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { RadioGroup, RadioGroupItem } from './UI/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './UI/dialog';
import { JournalCard } from './journal/JournalCard';
import { JournalModal } from './journal/JournalModal';
import { FilterButton } from './FilterButton';
import { FilterDialog } from './FilterDialog';
import { journalApi } from '../services/journal';
import type { JournalEntry, JournalFilters } from '../services/journal';
import type { TradeFilterRuntime } from '../types/trades';
import { formatDateToISO } from '../lib/api/trades';

// Market data interface
interface MarketMetric {
  label: string;
  value: string;
  change: number;
  changePercent: number;
}

// Legacy trade card interface (kept for compatibility)
interface TradeCard {
  id: string;
  symbol: string;
  name: string;
  date: string;
  profitLoss: number;
  profitLossPercent: number;
  type: 'profit' | 'loss';
  analysis: string;
}

// Report interface
interface Report {
  id: string;
  version: string;
  date: string;
  features: string[];
  challenges: string[];
  suggestions: string[];
}

// Report history item component
const HistoryItem: React.FC<{ 
  report: Report; 
  isSelected: boolean; 
  onClick: () => void; 
}> = ({ report, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2 rounded-lg text-[12px] transition-colors ${
        isSelected 
          ? 'bg-[#EFF6FF] text-[var(--accent-blue)]' 
          : 'text-[var(--grey-700)] hover:bg-[#F1F5F9]'
      }`}
    >
      ver.{report.version} ({report.date})
    </button>
  );
};

// Section block component with variants
const SectionBlock: React.FC<{ 
  title: string; 
  items: string[]; 
  variant: 'green' | 'red' | 'blue';
  icon: string;
}> = ({ title, items, variant, icon }) => {
  const colorClasses = {
    green: 'text-[var(--green-700)]',
    red: 'text-[var(--red-700)]',
    blue: 'text-[var(--blue-700)]'
  };

  return (
    <div className="mb-6">
      <h4 className={`text-[16px] font-bold mb-4 ${colorClasses[variant]}`}>
        {icon} {title}
      </h4>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="text-[14px] text-[var(--grey-700)] leading-relaxed">
            {index + 1}. {item}
          </li>
        ))}
      </ol>
    </div>
  );
};

// Report modal component
const ReportModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  reports: Report[];
}> = ({ isOpen, onClose, reports }) => {
  const [selectedReport, setSelectedReport] = useState<Report>(reports[0]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-[680px] w-full max-h-[85vh] overflow-hidden">
        <div className="p-8">
          <div className="flex gap-6 h-[500px]">
            {/* Left Sidebar - History */}
            <div className="w-[160px] border-r border-[var(--grey-200)] pr-4">
              <h3 className="text-[12px] font-bold text-[var(--grey-500)] mb-4">履歴</h3>
              <div className="space-y-2">
                {reports.map((report) => (
                  <HistoryItem
                    key={report.id}
                    report={report}
                    isSelected={selectedReport.id === report.id}
                    onClick={() => setSelectedReport(report)}
                  />
                ))}
              </div>
            </div>

            {/* Right Content - Report Details */}
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-[20px] font-semibold text-[var(--text-primary)] mb-6">
                レポート ver.{selectedReport.version} ({selectedReport.date})
              </h3>

              <SectionBlock
                title="特徴"
                items={selectedReport.features}
                variant="green"
                icon="✅"
              />

              <SectionBlock
                title="課題"
                items={selectedReport.challenges}
                variant="red"
                icon="❌"
              />

              <SectionBlock
                title="今後に向けた提案"
                items={selectedReport.suggestions}
                variant="blue"
                icon="🧠"
              />
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] bg-[var(--grey-200)] hover:bg-[var(--grey-300)] rounded-lg transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Insights Report Card component
const InsightsCard: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 shadow-sm mb-6">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart className="w-5 h-5 text-[var(--accent-blue)]" />
            <div>
              <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">
                My Trading Report
              </h3>
              <p className="text-[14px] text-[var(--grey-700)]">
                AIが分析した最新のトレーディングレポートを確認しましょう
              </p>
            </div>
          </div>
          <button
            onClick={onClick}
            className="bg-[var(--accent-blue)] text-white px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-[var(--blue-700)] transition-colors whitespace-nowrap"
            style={{ width: '120px', height: '40px' }}
          >
            詳細を見る
          </button>
        </div>
      </div>
    </div>
  );
};

// Metric component with variants
const MetricComponent: React.FC<{ metric: MarketMetric }> = ({ metric }) => {
  const isPositive = metric.change >= 0;
  
  return (
    <div className="min-w-[120px] flex flex-col gap-3">
      <span className="text-[14px] text-[var(--grey-500)] whitespace-nowrap">{metric.label}</span>
      <span className="text-[22px] font-semibold text-[var(--text-primary)] whitespace-nowrap">{metric.value}</span>
      <div className="flex items-center gap-1">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-[var(--success)] flex-shrink-0" />
        ) : (
          <TrendingDown className="w-4 h-4 text-[var(--error-new)] flex-shrink-0" />
        )}
        <span className={`text-[12px] whitespace-nowrap ${isPositive ? 'text-[var(--success)]' : 'text-[var(--error-new)]'}`}>
          {isPositive ? '+' : ''}{metric.changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

// Trade card component with profit/loss variants
const TradeCardComponent: React.FC<{ trade: TradeCard; onClick: () => void }> = ({ trade, onClick }) => {
  const isProfit = trade.type === 'profit';
  
  return (
    <Card 
      className={`p-4 rounded-xl cursor-pointer transition-shadow hover:shadow-lg border ${
        isProfit 
          ? 'border-[var(--success-300)] bg-[var(--success-50)]/40' 
          : 'border-[var(--error-300)] bg-[var(--error-50)]/40'
      }`}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{trade.symbol}</span>
            <span className="text-xs text-[var(--grey-500)]">{trade.name}</span>
          </div>
          <span className={`text-sm font-semibold ${
            isProfit ? 'text-[var(--success)]' : 'text-[var(--error-new)]'
          }`}>
            {isProfit ? '+' : ''}{trade.profitLossPercent.toFixed(2)}%
          </span>
        </div>
        
        {/* Date */}
        <div className="py-2">
          <span className="text-[10px] text-[var(--grey-500)]">{trade.date}</span>
        </div>
        
        {/* Chip */}
        <div className="flex">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium ${
            isProfit 
              ? 'bg-[var(--success)] text-white' 
              : 'bg-[var(--error-new)] text-white'
          }`}>
            {isProfit ? '利確' : '損切り'}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedTrade, setSelectedTrade] = useState<TradeCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // Journal state
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<JournalEntry | null>(null);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalLoading, setJournalLoading] = useState(false);

  // New filter state
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [filters, setFilters] = useState<TradeFilterRuntime>({
    type: 'all',
  });

  // Debug logging for filter dialog state
  useEffect(() => {
    console.log('Dashboard: showFilterDialog changed to:', showFilterDialog);
  }, [showFilterDialog]);

  // Mock market data
  const marketData = {
    japanese: [
      { label: 'NIKKEI', value: '32,891.70', change: 156.30, changePercent: 0.48 },
      { label: 'TOPIX', value: '2,385.12', change: 8.45, changePercent: 0.36 }
    ],
    us: [
      { label: 'S&P500', value: '4,739.21', change: -12.45, changePercent: -0.26 },
      { label: 'DOW', value: '37,545.33', change: 45.28, changePercent: 0.12 },
      { label: 'NASDAQ', value: '14,972.76', change: -85.46, changePercent: -0.57 }
    ],
    forex: [
      { label: 'USD/JPY', value: '149.85', change: -0.22, changePercent: -0.15 }
    ]
  };

  // Mock report data
  const reportData: Report[] = [
    {
      id: '1',
      version: '3',
      date: '2025-01-28',
      features: [
        'リスク管理の向上により、平均損失額が前月比20%減少',
        'エントリータイミングの精度が向上し、勝率が65%に上昇',
        'ポジションサイジングの最適化により、リスクリワード比が改善'
      ],
      challenges: [
        '利確タイミングが早すぎる傾向があり、利益の最大化が不十分',
        '市場の急変時における対応速度の改善が必要',
        '感情的な取引判断により、計画外のエントリーが3回発生'
      ],
      suggestions: [
        'トレンドフォロー戦略の強化により、利益確定タイミングを最適化',
        'ストップロスの見直しにより、リスク管理をさらに強化',
        '取引日誌の詳細化により、感情的判断のパターンを分析・改善'
      ]
    },
    {
      id: '2',
      version: '2',
      date: '2025-01-14',
      features: [
        'テクニカル分析の精度向上により、エントリーポイントが改善',
        'リスクリワード比1:2以上の取引が全体の70%を占めるように',
        '損切りルールの徹底により、大幅な損失を回避'
      ],
      challenges: [
        '利確ポイントの設定が保守的すぎて、利益を取り逃がす場面が多発',
        'ボラティリティの高い銘柄での取引判断に課題',
        'マーケット全体のトレンド分析の精度向上が必要'
      ],
      suggestions: [
        'トレーリングストップの活用により利益の最大化を図る',
        'セクター分析を強化し、個別銘柄選択の精度を向上',
        'マクロ経済指標の監視体制を強化'
      ]
    },
    {
      id: '3',
      version: '1',
      date: '2024-12-30',
      features: [
        '基本的なリスク管理ルールが確立され、安定した取引が可能に',
        'チャート分析の基礎が身につき、エントリーポイントの精度が向上',
        '取引記録の習慣化により、振り返りが可能な体制を構築'
      ],
      challenges: [
        'ポジションサイズが不安定で、リスク管理に一貫性が不足',
        '利確・損切りの判断基準が曖昧で、感情的な取引が多発',
        'マーケット分析の深度が不足しており、銘柄選択の精度に課題'
      ],
      suggestions: [
        'ポジションサイズの計算方法を標準化し、リスク管理を体系化',
        'テクニカル指標の学習を深め、客観的な判断基準を確立',
        '日々のマーケットレビューを習慣化し、分析力を向上'
      ]
    }
  ];
  
  
  // Load journal entries from API
  const loadJournalEntries = async (filters: JournalFilters = {}) => {
    setJournalLoading(true);
    try {
      const response = await journalApi.getEntries(filters);
      setJournalEntries(response.entries);
    } catch (error) {
      console.error('Failed to load journal entries:', error);
    } finally {
      setJournalLoading(false);
    }
  };
  
  // Handle journal card click
  const handleJournalCardClick = (entry: JournalEntry) => {
    setSelectedJournalEntry(entry);
    setIsJournalModalOpen(true);
  };
  
  // Handle journal modal close
  const handleJournalModalClose = () => {
    setIsJournalModalOpen(false);
    setSelectedJournalEntry(null);
  };
  
  // Convert TradeFilterRuntime to JournalFilters
  const convertToJournalFilters = (tradeFilters: TradeFilterRuntime): JournalFilters => {
    const journalFilters: JournalFilters = {};
    
    if (tradeFilters.from) journalFilters.fromDate = formatDateToISO(tradeFilters.from);
    if (tradeFilters.to) journalFilters.toDate = formatDateToISO(tradeFilters.to);
    if (tradeFilters.q) journalFilters.symbol = tradeFilters.q;
    if (tradeFilters.type === 'profit') journalFilters.pnl = 'win';
    if (tradeFilters.type === 'loss') journalFilters.pnl = 'lose';
    
    return journalFilters;
  };

  // Apply filters to journal entries
  const applyJournalFilters = (tradeFilters: TradeFilterRuntime = filters) => {
    const journalFilters = convertToJournalFilters(tradeFilters);
    loadJournalEntries(journalFilters);
  };

  // Handle filter submission
  const handleFilterSubmit = (newFilters: TradeFilterRuntime) => {
    setFilters(newFilters);
    applyJournalFilters(newFilters);
  };

  // Check if filters are active
  const hasActiveFilters = (filters: TradeFilterRuntime): boolean => {
    return !!(
      filters.from ||
      filters.to ||
      filters.q ||
      (filters.type && filters.type !== 'all')
    );
  };

  // Remove individual filter
  const removeFilter = (filterType: 'type' | 'q' | 'date') => {
    const newFilters = { ...filters };
    
    if (filterType === 'type') {
      newFilters.type = 'all';
    } else if (filterType === 'q') {
      delete newFilters.q;
    } else if (filterType === 'date') {
      delete newFilters.from;
      delete newFilters.to;
    }
    
    setFilters(newFilters);
    applyJournalFilters(newFilters);
  };

  // Mock trade data
  const tradeData: TradeCard[] = [
    {
      id: '1',
      symbol: '7203',
      name: 'トヨタ自動車',
      date: '2024/01/15',
      profitLoss: 15000,
      profitLossPercent: 2.5,
      type: 'profit',
      analysis: 'トヨタ自動車の取引分析：\n\n根本原因：四半期決算発表前の期待買いが発生。自動車販売台数の改善が好材料となった。\n\nリスクリワード比：1:2.5で適切なポジションサイジング。\n\n改善案：利確タイミングをもう少し遅らせることで、より大きな利益を狙えた可能性がある。'
    },
    {
      id: '2',
      symbol: '9984',
      name: 'ソフトバンクG',
      date: '2024/01/12',
      profitLoss: -8000,
      profitLossPercent: -1.8,
      type: 'loss',
      analysis: 'ソフトバンクグループの取引分析：\n\n根本原因：市場全体の下落に加え、テック株への懸念が強まった。予想以上の下落幅となった。\n\nリスクリワード比：1:1.5で設定していたが、損切りラインを適切に守れた。\n\n改善案：エントリー前のテクニカル分析をより慎重に行い、サポートライン近辺でのエントリーを検討すべきだった。'
    },
    {
      id: '3',
      symbol: '6758',
      name: 'ソニーグループ',
      date: '2024/01/10',
      profitLoss: 22000,
      profitLossPercent: 4.2,
      type: 'profit',
      analysis: 'ソニーグループの取引分析：\n\n根本原因：新製品発表とゲーム事業の好調な業績が株価を押し上げた。\n\nリスクリワード比：1:3.0で理想的な取引となった。\n\n改善案：ポジションサイズをもう少し大きくしても良かった。リスク管理の範囲内での取引量増加を検討。'
    },
    {
      id: '4',
      symbol: '8001',
      name: '伊藤忠商事',
      date: '2024/01/08',
      profitLoss: -5500,
      profitLossPercent: -1.2,
      type: 'loss',
      analysis: '伊藤忠商事の取引分析：\n\n根本原因：商品価格の下落と円高進行により、商社株全般が売られた。\n\nリスクリワード比：1:2.0で設定していたが、マクロ要因による急落で損切りとなった。\n\n改善案：商品価格や為替動向をより注意深く監視し、マクロ環境の変化に対応したポジション調整が必要。'
    }
  ];

  const handleCardClick = (trade: TradeCard) => {
    setSelectedTrade(trade);
    setIsModalOpen(true);
  };

  // Load initial data
  useEffect(() => {
    applyJournalFilters();
  }, []);

  return (
    <div className="min-h-screen bg-white font-inter">


      <div className="max-w-[1440px] mx-auto px-8 py-8">
        {/* Market Bar */}
        <div className="flex gap-8 h-[128px] items-center bg-white border border-[var(--grey-200)] rounded-xl shadow-sm p-8 mb-6 overflow-x-auto">
          {/* Japanese Stocks */}
          <div className="flex flex-col gap-3 min-w-fit">
            <span className="text-[16px] font-medium text-[var(--text-primary)]">日本株</span>
            <div className="flex gap-8">
              {marketData.japanese.map((metric, index) => (
                <MetricComponent key={index} metric={metric} />
              ))}
            </div>
          </div>
          
          {/* US Stocks */}
          <div className="flex flex-col gap-3 min-w-fit">
            <span className="text-[16px] font-medium text-[var(--text-primary)]">米国株</span>
            <div className="flex gap-8">
              {marketData.us.map((metric, index) => (
                <MetricComponent key={index} metric={metric} />
              ))}
            </div>
          </div>
          
          {/* Forex */}
          <div className="flex flex-col gap-3 min-w-fit">
            <span className="text-[16px] font-medium text-[var(--text-primary)]">為替</span>
            <div className="flex gap-8">
              {marketData.forex.map((metric, index) => (
                <MetricComponent key={index} metric={metric} />
              ))}
            </div>
          </div>
        </div>

        {/* Insights Card */}
        <InsightsCard onClick={() => setIsReportModalOpen(true)} />

        {/* Heading with Filter Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">トレードジャーナル</h2>
            {journalEntries.length > 0 && (
              <p className="text-sm text-[var(--grey-500)] mt-1">
                {journalEntries.length}件のトレード記録
              </p>
            )}
          </div>
          
          <FilterButton
            hasActive={hasActiveFilters(filters)}
            onOpen={() => setShowFilterDialog(true)}
          />
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters(filters) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-700 font-medium">適用中のフィルター:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.type && filters.type !== 'all' && (
                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded flex items-center gap-1">
                  結果: {filters.type === 'profit' ? '利確' : '損切り'}
                  <button
                    onClick={() => removeFilter('type')}
                    className="ml-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full p-0.5"
                    aria-label="結果フィルターを削除"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.q && (
                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded flex items-center gap-1">
                  検索: {filters.q}
                  <button
                    onClick={() => removeFilter('q')}
                    className="ml-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full p-0.5"
                    aria-label="検索フィルターを削除"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {(filters.from || filters.to) && (
                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded flex items-center gap-1">
                  期間: {filters.from ? formatDateToISO(filters.from) : '開始日不明'} 〜 {filters.to ? formatDateToISO(filters.to) : '終了日不明'}
                  <button
                    onClick={() => removeFilter('date')}
                    className="ml-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full p-0.5"
                    aria-label="期間フィルターを削除"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Trade Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {journalLoading ? (
            <div className="col-span-full text-center py-8 text-[var(--grey-500)]">
              読み込み中...
            </div>
          ) : journalEntries.length > 0 ? (
            journalEntries.map((entry) => (
              <JournalCard
                key={entry.trade_id}
                entry={entry}
                onClick={() => handleJournalCardClick(entry)}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-[var(--grey-500)]">
              トレードジャーナルデータがありません
            </div>
          )}
        </div>

        {/* Journal Modal */}
        <JournalModal
          entry={selectedJournalEntry}
          isOpen={isJournalModalOpen}
          onClose={handleJournalModalClose}
        />

        {/* Legacy Modal (kept for compatibility) */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-[80%] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[var(--text-primary)]">
                {selectedTrade?.symbol} {selectedTrade?.name} 取引振り返り
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <p className="text-sm text-[var(--grey-700)] whitespace-pre-line leading-relaxed">
                {selectedTrade?.analysis}
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="text-xs px-4 py-2 border-[var(--grey-200)] hover:bg-[var(--grey-300)] text-[var(--grey-500)]"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Filter Dialog */}
        <FilterDialog
          open={showFilterDialog}
          onOpenChange={setShowFilterDialog}
          value={filters}
          onSubmit={handleFilterSubmit}
        />

        {/* Report Modal */}
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          reports={reportData}
        />
      </div>
    </div>
  );
}
