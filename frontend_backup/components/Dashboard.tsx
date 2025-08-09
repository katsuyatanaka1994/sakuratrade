import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, X, Settings, BarChart } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Market data interface
interface MarketMetric {
  label: string;
  value: string;
  change: number;
  changePercent: number;
}

// Trade card interface
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedTrade, setSelectedTrade] = useState<TradeCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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

  const filteredTrades = tradeData.filter(trade => {
    if (filterType === 'profit' && trade.type !== 'profit') return false;
    if (filterType === 'loss' && trade.type !== 'loss') return false;
    if (symbolSearch && !trade.symbol.includes(symbolSearch)) return false;
    return true;
  });

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

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">トレードジャーナル</h2>
        </div>

        {/* Search Section */}
        <div className="bg-white border border-[var(--grey-200)] rounded-xl p-6 mb-6">
          <div className="flex flex-wrap gap-8">
            {/* Start Date */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-[var(--grey-500)]">日付 開始</Label>
              <Input
                placeholder="年/月/日"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[120px] h-10 border-[var(--grey-200)] focus:border-[var(--accent-blue)] text-sm"
              />
            </div>
            
            {/* End Date */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-[var(--grey-500)]">日付 終了</Label>
              <Input
                placeholder="年/月/日"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[120px] h-10 border-[var(--grey-200)] focus:border-[var(--accent-blue)] text-sm"
              />
            </div>
            
            {/* Symbol Search */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-[var(--grey-500)]">銘柄検索</Label>
              <Input
                placeholder="コード"
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                className="w-[120px] h-10 border-[var(--grey-200)] focus:border-[var(--accent-blue)] text-sm"
              />
            </div>
            
            {/* Radio Group */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-[var(--grey-500)]">利確 / 損切り</Label>
              <RadioGroup value={filterType} onValueChange={setFilterType} className="flex gap-6 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" className="data-[state=checked]:bg-[var(--accent-blue)] data-[state=checked]:border-[var(--accent-blue)]" />
                  <Label htmlFor="all" className="text-sm">全て</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="profit" id="profit" className="data-[state=checked]:bg-[var(--accent-blue)] data-[state=checked]:border-[var(--accent-blue)]" />
                  <Label htmlFor="profit" className="text-sm">利確</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="loss" id="loss" className="data-[state=checked]:bg-[var(--accent-blue)] data-[state=checked]:border-[var(--accent-blue)]" />
                  <Label htmlFor="loss" className="text-sm">損切り</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        {/* Trade Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTrades.map((trade) => (
            <TradeCardComponent
              key={trade.id}
              trade={trade}
              onClick={() => handleCardClick(trade)}
            />
          ))}
        </div>

        {/* Modal */}
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