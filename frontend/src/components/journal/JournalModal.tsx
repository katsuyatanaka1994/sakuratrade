import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../UI/dialog';
import { Button } from '../UI/button';
import { ExternalLink, MessageCircle } from 'lucide-react';
import type { JournalEntry } from '../../services/journal';
import { journalApi } from '../../services/journal';
import { useSymbolSuggest } from '../../hooks/useSymbolSuggest';
import { useNavigate } from 'react-router-dom';

interface JournalModalProps {
  entry: JournalEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export const JournalModal: React.FC<JournalModalProps> = ({ entry, isOpen, onClose }) => {
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { findByCode } = useSymbolSuggest();
  const navigate = useNavigate();
  
  const symbolInfo = entry ? findByCode(entry.symbol) : null;
  const symbolName = symbolInfo?.name || '';

  useEffect(() => {
    if (entry && isOpen && entry.feedback_text) {
      // Use stored feedback text first
      setFeedbackText(entry.feedback_text);
    } else if (entry && isOpen) {
      // Fetch from API as fallback
      setLoading(true);
      journalApi.getFeedback(entry.trade_id)
        .then(response => {
          setFeedbackText(response.feedback_text);
        })
        .catch(error => {
          console.error('Failed to fetch feedback:', error);
          setFeedbackText('フィードバックの読み込みに失敗しました。');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [entry, isOpen]);

  if (!entry) return null;

  const isProfit = entry.pnl_abs > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{entry.symbol} {symbolName} トレード詳細</span>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              entry.side === 'LONG' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {entry.side === 'LONG' ? 'ロング' : 'ショート'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trade Summary */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-sm text-[var(--grey-500)]">損益額</span>
              <p className={`text-lg font-medium ${
                isProfit ? 'text-green-600' : 'text-red-600'
              }`}>
                {isProfit ? '+' : ''}{entry.pnl_abs.toLocaleString()}円
              </p>
            </div>
            <div>
              <span className="text-sm text-[var(--grey-500)]">損益率</span>
              <p className={`text-lg font-medium ${
                isProfit ? 'text-green-600' : 'text-red-600'
              }`}>
                {isProfit ? '+' : ''}{entry.pnl_pct.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Analysis */}
          {entry.analysis_score !== undefined && entry.analysis_labels && (
            <div className="p-4 bg-[var(--grey-50)] rounded-lg">
              <h3 className="font-medium mb-3">AI解析結果</h3>
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <span className="text-sm text-[var(--grey-500)]">スコア</span>
                  <p className="text-lg font-medium">{entry.analysis_score}/100</p>
                </div>
                <div>
                  <span className="text-sm text-[var(--grey-500)]">ラベル</span>
                  <div className="flex gap-2 mt-1">
                    {entry.analysis_labels.slice(0, 3).map((label, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-white rounded border">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Content */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">トレードフィードバック</h3>
              {entry.feedback_message_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    // Navigate to chat and highlight the specific message
                    onClose(); // Close modal first
                    navigate(`/trade?chat=${entry.chat_id}&highlight=${entry.feedback_message_id}`);
                  }}
                >
                  <MessageCircle className="w-3 h-3 mr-1" />
                  チャットで表示
                </Button>
              )}
            </div>
            
            <div className="p-4 bg-[var(--grey-50)] rounded-lg">
              {loading ? (
                <div className="text-center text-[var(--grey-500)]">読み込み中...</div>
              ) : feedbackText ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {feedbackText}
                </div>
              ) : (
                <div className="text-center text-[var(--grey-500)]">
                  フィードバックデータがありません
                </div>
              )}
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              閉じる
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function formatHoldDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間`;
  return `${Math.floor(minutes / 1440)}日`;
}