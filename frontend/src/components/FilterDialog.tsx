import React, { useState, useEffect } from 'react';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { DateRangeOverlay } from './DateRangeOverlay';
import { TradeFilterRuntime, TradeType, DateRange } from '../types/trades';

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: TradeFilterRuntime;
  onSubmit: (value: TradeFilterRuntime) => void;
}

export const FilterDialog: React.FC<FilterDialogProps> = ({
  open,
  onOpenChange,
  value,
  onSubmit,
}) => {
  const [localFilters, setLocalFilters] = useState<TradeFilterRuntime>(value);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    console.log('FilterDialog open state changed:', open);
    if (open) {
      setLocalFilters(value);
    }
  }, [open, value]);

  const handleTypeChange = (type: TradeType) => {
    setLocalFilters(prev => ({ ...prev, type }));
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFilters(prev => ({ ...prev, q: e.target.value }));
  };

  const handleDateRangeChange = (dateRange: DateRange) => {
    setLocalFilters(prev => ({
      ...prev,
      from: dateRange.from,
      to: dateRange.to,
    }));
  };

  const handleSubmit = () => {
    onSubmit(localFilters);
    onOpenChange(false);
  };

  const handleClose = () => {
    console.log('FilterDialog close clicked, resetting filters and closing dialog');
    setLocalFilters(value);
    onOpenChange(false);
  };

  const handleClearConditions = () => {
    console.log('FilterDialog clear conditions clicked');
    const clearedFilters: TradeFilterRuntime = { type: 'all' };
    setLocalFilters(clearedFilters);
  };

  const hasAnyFilters = () => {
    return !!(
      localFilters.q ||
      localFilters.from ||
      localFilters.to ||
      (localFilters.type && localFilters.type !== 'all')
    );
  };

  const formatDateRange = () => {
    const { from, to } = localFilters;
    if (!from && !to) return '— — —';
    if (from && !to) {
      return `${from.getFullYear()}/${from.getMonth() + 1}/${from.getDate()} から`;
    }
    if (!from && to) {
      return `〜 ${to.getFullYear()}/${to.getMonth() + 1}/${to.getDate()}`;
    }
    if (from && to) {
      return `${from.getFullYear()}/${from.getMonth() + 1}/${from.getDate()} 〜 ${to.getFullYear()}/${to.getMonth() + 1}/${to.getDate()}`;
    }
    return '— — —';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
          <div 
            className="bg-white rounded-xl shadow-xl p-8 w-[28rem] max-w-[90vw]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-title"
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-8">
              <h2 id="filter-title" className="text-xl font-semibold">
                フィルター
              </h2>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose();
                }}
                className="p-1 hover:bg-gray-100 rounded-md"
                aria-label="閉じる"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 結果フィルター */}
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-4">結果</h3>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tradeType"
                    value="all"
                    checked={localFilters.type === 'all' || !localFilters.type}
                    onChange={() => handleTypeChange('all')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">すべて</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tradeType"
                    value="profit"
                    checked={localFilters.type === 'profit'}
                    onChange={() => handleTypeChange('profit')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">利確</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tradeType"
                    value="loss"
                    checked={localFilters.type === 'loss'}
                    onChange={() => handleTypeChange('loss')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">損切り</span>
                </label>
              </div>
            </div>

            {/* 銘柄検索 */}
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-4">銘柄検索</h3>
              <Input
                type="text"
                placeholder="コードまたは銘柄名を入力"
                value={localFilters.q || ''}
                onChange={handleQueryChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 日付 */}
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-4">日付</h3>
              <button
                onClick={() => setShowDatePicker(true)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center gap-3 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={localFilters.from || localFilters.to ? 'text-gray-900' : 'text-gray-500'}>
                  {formatDateRange()}
                </span>
              </button>
            </div>

            {/* フッター */}
            <div className="flex justify-between items-center">
              {hasAnyFilters() && (
                <Button 
                  variant="outline" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClearConditions();
                  }}
                  type="button"
                  className="text-gray-600 hover:text-gray-800"
                >
                  条件をクリア
                </Button>
              )}
              
              <div className={`flex justify-end ${hasAnyFilters() ? '' : 'w-full'}`}>
                <Button 
                  onClick={handleSubmit}
                  className="bg-black text-white hover:bg-gray-800 px-6"
                >
                  検索する
                </Button>
              </div>
            </div>
          </div>
        </div>

      {/* 日付範囲選択オーバーレイ */}
      <DateRangeOverlay
        open={showDatePicker}
        onOpenChange={setShowDatePicker}
        value={{ from: localFilters.from, to: localFilters.to }}
        onChange={handleDateRangeChange}
      />
    </>
  );
};