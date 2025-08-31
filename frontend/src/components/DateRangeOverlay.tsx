import React, { useState, useEffect } from 'react';
import { Button } from './UI/button';
import type { DateRange } from '../types/trades';

interface DateRangeOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DateRange;
  onChange: (value: DateRange) => void;
}

export const DateRangeOverlay: React.FC<DateRangeOverlayProps> = ({
  open,
  onOpenChange,
  value,
  onChange,
}) => {
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [tempRange, setTempRange] = useState<DateRange>(value);

  useEffect(() => {
    if (open) {
      setTempRange(value);
      // 初期表示月を設定（fromがあればその月、なければ今月）
      if (value.from) {
        setDisplayYear(value.from.getFullYear());
        setDisplayMonth(value.from.getMonth());
      } else {
        const now = new Date();
        setDisplayYear(now.getFullYear());
        setDisplayMonth(now.getMonth());
      }
    }
  }, [open, value]);

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayYear(displayYear - 1);
      setDisplayMonth(11);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayYear(displayYear + 1);
      setDisplayMonth(0);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };


  const handleDateClick = (date: Date) => {
    const { from, to } = tempRange;
    
    if (!from || (from && to)) {
      // 初回選択または範囲選択済みの場合は新規開始
      setTempRange({ from: date, to: null });
    } else if (from && !to) {
      // 終了日を選択
      if (date < from) {
        // 逆順選択の場合は自動入替
        setTempRange({ from: date, to: from });
      } else {
        setTempRange({ from, to: date });
      }
    }
  };

  const handleComplete = () => {
    onChange(tempRange);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTempRange(value);
    onOpenChange(false);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isInRange = (date: Date) => {
    const { from, to } = tempRange;
    if (!from) return false;
    if (!to) return date.getTime() === from.getTime();
    return date >= from && date <= to;
  };

  const isRangeStart = (date: Date) => {
    return tempRange.from && date.getTime() === tempRange.from.getTime();
  };

  const isRangeEnd = (date: Date) => {
    return tempRange.to && date.getTime() === tempRange.to.getTime();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(displayYear, displayMonth);
    const firstDay = getFirstDayOfMonth(displayYear, displayMonth);
    const days = [];

    // 曜日ヘッダー
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // 前月の空白セル
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-16 h-16" />);
    }

    // 日付セル
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(displayYear, displayMonth, day);
      const today = isToday(date);
      const inRange = isInRange(date);
      const rangeStart = isRangeStart(date);
      const rangeEnd = isRangeEnd(date);

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          aria-label={`${displayYear}-${displayMonth + 1}-${day}`}
          className={`
            w-16 h-16 flex items-center justify-center text-lg font-medium rounded-xl
            transition-colors hover:bg-gray-100
            ${today ? 'border border-gray-400' : ''}
            ${inRange ? 'bg-blue-100' : ''}
            ${rangeStart || rangeEnd ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
            ${!inRange && !today ? 'hover:bg-gray-50' : ''}
          `}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="grid grid-cols-7" style={{ columnGap: '20px', rowGap: '18px' }}>
        {/* 曜日ヘッダー */}
        {weekDays.map((day) => (
          <div key={day} className="w-16 h-12 flex items-center justify-center text-base font-medium text-gray-500">
            {day}
          </div>
        ))}
        {/* 日付 */}
        {days}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-8 flex flex-col"
        style={{ width: '840px', height: '720px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 rounded-md"
            aria-label="前月"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 id="calendar-title" className="text-xl font-semibold">
            {displayYear}年{displayMonth + 1}月
          </h2>

          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 rounded-md"
            aria-label="翌月"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* カレンダー */}
        <div className="flex-1 flex items-center justify-center">
          {renderCalendar()}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={handleCancel}>
            キャンセル
          </Button>
          <Button onClick={handleComplete} className="bg-black text-white hover:bg-gray-800">
            完了
          </Button>
        </div>
      </div>
    </div>
  );
};