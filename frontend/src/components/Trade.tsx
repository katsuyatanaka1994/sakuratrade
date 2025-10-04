import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { 
  Upload, 
  Send,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { marked } from "marked";
import { useSearchParams } from 'react-router-dom';
import './integrated-analysis-report.css';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './UI/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './UI/select';
import Sidebar from './Sidebar';
import ImageModal from './ImageModal';
import RightPanePositions from './positions/RightPanePositions';
import AutocompleteSymbol from './AutocompleteSymbol';
import ChartImageUploader from './ChartImageUploader';
import EntryMessageActions from './EntryMessageActions';
import EntryDeleteDialog from './EntryDeleteDialog';
import { getLatestSymbolFromChat, loadSymbols } from '../utils/symbols';
import type { ChatMsg } from '../utils/symbols';
import { useSymbolSuggest } from '../hooks/useSymbolSuggest';
import { useToast } from './ToastContainer';
import { entry as positionsEntry, settle as positionsSettle, submitJournalEntry, getLongShortQty, updatePosition, recordSettlement as positionsRecordSettlement, getSettlementRecord, unsettle as positionsUnsettle, getState as getPositionsState, removeEntryLot, deletePosition as storeDeletePosition } from '../store/positions';
import type { TradeSnapshot } from '../store/positions';
import { recordEntryDeleted, recordEntryEdited } from '../lib/auditLogger';
import type { EntryAuditSnapshot } from '../lib/auditLogger';
import { convertChatMessageToTradeMessage } from '../utils/messageAdapter';
import { undoChatMessage, updateChatMessage } from '../services/api';
import { createChatMessage, generateAIReply } from '../services/api';
import { CHART_PATTERNS, CHART_PATTERN_LABEL_MAP } from '../constants/chartPatterns';
import type { ChartPattern } from '../types/chat';
import { loadTradePlanConfig, createPlanLegacyMessage } from '../utils/tradePlanMessage';

// Helper function to get API URL - hardcoded for now to debug
const getApiUrl = () => {
  console.log('🔧 getApiUrl called');
  return "http://localhost:8000";
};

// Helper function to extract chat feedback for a specific trade
const extractChatFeedbackForTrade = (messages: Message[], symbol: string, symbolName?: string): string | null => {
  // Get recent bot messages that might contain trade analysis for this symbol
  const recentBotMessages = messages
    .filter(msg => msg.type === 'bot')
    .reverse() // Get latest first
    .slice(0, 15); // Check last 15 bot messages
  
  // Look for messages containing the symbol or analysis keywords
  for (const message of recentBotMessages) {
    const content = message.content.toLowerCase();
    const symbolLower = symbol.toLowerCase();
    const symbolNameLower = symbolName?.toLowerCase() || '';
    
    // Check if message contains the symbol, symbol name, or analysis-related keywords
    const containsSymbol = content.includes(symbolLower) || 
                          content.includes(symbol) ||
                          (symbolNameLower && content.includes(symbolNameLower));
    
    if (containsSymbol) {
      // Look for analysis, feedback, or advice keywords
      const hasAnalysisKeywords = [
        '分析', '解析', 'アドバイス', '振り返り', '判断', '戦略', 
        '評価', 'フィードバック', '考察', '見解', '提案', '材料',
        'チャート', 'テクニカル', 'ファンダメンタル', 'リスク',
        '目標', 'ストップ', '利確', 'エントリー'
      ].some(keyword => content.includes(keyword));
      
      if (hasAnalysisKeywords && message.content.length > 50) {
        // Return the original message content (with HTML tags removed)
        console.log('📋 Found chat feedback for', symbol, ':', message.content.substring(0, 100) + '...');
        return message.content.replace(/<[^>]*>/g, '').trim();
      }
    }
  }
  
  console.log('📋 No specific chat feedback found for', symbol, ', using fallback');
  return null;
};

// Helper function to extract stock name from user message
const extractStockName = (message: string): string | null => {
  // Simple regex to extract 4-digit codes or company names
  const codeMatch = message.match(/(\d{4})/);
  if (codeMatch) {
    return `Stock ${codeMatch[1]}`;
  }
  
  // Extract Japanese company names (katakana/hiragana/kanji)
  const nameMatch = message.match(/([ぁ-ゟァ-ヿ一-龯]+)/g);
  if (nameMatch && nameMatch.length > 0) {
    // Return the first meaningful word that's longer than 1 character
    const meaningfulName = nameMatch.find(name => name.length > 1 && !['について', 'です', 'ます', 'した'].includes(name));
    return meaningfulName || null;
  }
  
  return null;
};

// Helper functions will be defined inside the component

// Message interface for chat
interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  isTradeAction?: boolean; // 取引アクション（建値入力・決済）メッセージかどうか
  entryPermissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    reasons?: {
      edit?: string;
      delete?: string;
    } | string;
  };
  relatedEntryId?: string;
}

// Chat interface for chat management
interface Chat {
  id: string;
  name: string;
  messages: Message[];
  updatedAt: string;
}

interface ParsedEntryMessage {
  symbolCode: string;
  side: 'LONG' | 'SHORT';
  price?: number;
  qty?: number;
  chartPattern?: string;
  note?: string;
  tradeId?: string;
}

type EntryFormState = {
  symbol: string;
  side: 'long' | 'short';
  price: string;
  qty: string;
  chartPattern: ChartPattern | '';
  memo: string;
};

const normalizeSymbolCode = (raw: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const [first] = trimmed.split(/[\s　]+/);
  return first ?? '';
};

const parseEntryMessage = (message: Message): ParsedEntryMessage | null => {
  if (!message.content.includes('建値入力しました')) return null;
  const content = message.content;
  const plainText = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '');

  const symbolMatch = plainText.match(/銘柄[:：]\s*([^\n]+)/);
  const symbolText = symbolMatch ? symbolMatch[1].trim() : '';
  const symbolCode = normalizeSymbolCode(symbolText);
  const positionMatch = plainText.match(/ポジションタイプ[:：]\s*([^\n]+)/);
  const positionText = positionMatch ? positionMatch[1].trim() : '';
  const side: 'LONG' | 'SHORT' = positionText.includes('ショート') || positionText.includes('SHORT') ? 'SHORT' : 'LONG';
  const priceMatch = plainText.match(/建値[:：]\s*([\d,]+)円/);
  const qtyMatch = plainText.match(/数量[:：]\s*([\d,]+)株/);
  const patternMatch = plainText.match(/チャートパターン[:：]\s*([^\n]+)/);
  const patternLabel = patternMatch ? patternMatch[1].trim() : undefined;
  const patternEntry = patternLabel
    ? CHART_PATTERNS.find((pattern) => pattern.label === patternLabel)
    : undefined;
  const noteMatch = plainText.match(/(?:📝\s*|メモ[:：]\s*)([^\n]+)/);
  const tradeMatch = plainText.match(/取引ID[:：]\s*([^\n]+)/);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : undefined;
  const qty = qtyMatch ? Number(qtyMatch[1].replace(/,/g, '')) : undefined;

  if (!symbolCode) {
    return null;
  }

  return {
    symbolCode,
    side,
    price,
    qty,
    chartPattern: patternEntry?.value,
    note: noteMatch ? noteMatch[1].trim() : undefined,
    tradeId: tradeMatch ? tradeMatch[1].trim() : undefined,
  };
};

const parseExitMessageContent = (content: string): { symbolCode: string; side: 'LONG' | 'SHORT' } | null => {
  if (typeof content !== 'string' || !includesExitMessage(content)) {
    return null;
  }

  const plainText = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '');

  const symbolMatch = plainText.match(/銘柄[:：]\s*([^\n]+)/);
  const symbolText = symbolMatch ? symbolMatch[1].trim() : '';
  const symbolCode = normalizeSymbolCode(symbolText);
  if (!symbolCode) {
    return null;
  }

  const positionMatch = plainText.match(/ポジションタイプ[:：]\s*([^\n]+)/);
  const positionText = positionMatch ? positionMatch[1].trim() : '';
  const side: 'LONG' | 'SHORT' = positionText.includes('ショート') || positionText.includes('SHORT') ? 'SHORT' : 'LONG';

  return { symbolCode, side };
};

const auditNote = (note?: string) => (note ? note.slice(0, 120) : undefined);

// Image preview attachment type for chat input
type ChatImageType = 'image/png' | 'image/jpeg' | 'image/webp';
interface ChatImage {
  id: string;
  file: File;
  url: string;
  size: number;
  type: ChatImageType;
}

const includesExitMessage = (content: string) =>
  content.includes('約定しました') || content.includes('決済しました');

// Feature flag: allow editing from chat bubbles (ENTRY/EXIT/TEXT)
const ENABLE_CHAT_BUBBLE_EDIT = true;
const ENTRY_ACTION_DISABLED_REASON = '決済済みのため操作できません';
const SETTLED_ENTRIES_STORAGE_KEY = 'trade_settled_entries_v1';

const loadSettledEntriesFromStorage = (): Set<string> => {
  if (typeof window === 'undefined') {
    return new Set();
  }

  try {
    const stored = window.localStorage.getItem(SETTLED_ENTRIES_STORAGE_KEY);
    if (!stored) {
      return new Set();
    }

    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const ids = parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
      return new Set(ids);
    }
  } catch (error) {
    console.warn('Failed to load settled entry IDs from storage:', error);
  }

  return new Set();
};

// MessageBubble Component with improved style & timestamp below bubble
const MessageBubble: React.FC<{
  message: Message;
  onImageClick?: (imageUrl: string) => void;
  isHighlighted?: boolean;
  onMessageEdit?: (message: Message) => void;
  onMessageUndo?: (message: Message) => void;
  isEntrySettled?: (message: Message) => boolean;
  entryCanEdit?: boolean;
  entryCanDelete?: boolean;
  entryDisabledReason?: string | { edit?: string; delete?: string };
  onEntryDelete?: (message: Message) => void;
  isDeleting?: boolean;
}> = ({
  message,
  onImageClick,
  isHighlighted,
  onMessageEdit,
  onMessageUndo,
  isEntrySettled,
  entryCanEdit,
  entryCanDelete,
  entryDisabledReason,
  onEntryDelete,
  isDeleting = false,
}) => {
  const isUser = message.type === 'user';
  const messageRef = React.useRef<HTMLDivElement>(null);
  const [showHoverActions, setShowHoverActions] = React.useState(false);

  // 編集対象: ユーザーが自由入力したメッセージのみ
  // 非対象: 取引アクション（ENTRY/EXIT）やユーザー通知（建値更新など）
  const isTradeAction = Boolean((message as any).isTradeAction);
  const hasInlineImages = typeof message.content === 'string' && /<img\b|data-image-url=/.test(message.content);
  const isUserUpdateNotice =
    typeof message.content === 'string' && (
      message.content.includes('建値を更新しました') ||
      message.content.includes('建値入力しました') ||
      includesExitMessage(message.content)
    );
  const isEligibleForEdit = ENABLE_CHAT_BUBBLE_EDIT && isUser && !isTradeAction && !isUserUpdateNotice && !hasInlineImages;
  // EXIT bubble detection and 30-min window for Undo icon visibility
  const isExitBubble = Boolean(isTradeAction && typeof message.content === 'string' && includesExitMessage(message.content));
  const canUndoWindow = (() => {
    try {
      const ts = new Date(message.timestamp).getTime();
      if (!isFinite(ts)) return true; // fallback: show when timestamp unparsable
      return Date.now() - ts <= 30 * 60 * 1000;
    } catch {
      return true;
    }
  })();
  const canShowUndo = isExitBubble && canUndoWindow;

  const isEntryMessage = Boolean(
    isTradeAction &&
      typeof message.content === 'string' &&
      message.content.includes('建値入力しました')
  );

  const resolvedEntryActions = React.useMemo(() => {
    if (!isEntryMessage) return null;
    const settled = isEntrySettled?.(message) ?? false;
    const canEditFinal = entryCanEdit ?? !settled;
    const canDeleteFinal = entryCanDelete ?? !settled;
    const rawReasons = entryDisabledReason ?? (settled ? { edit: ENTRY_ACTION_DISABLED_REASON, delete: ENTRY_ACTION_DISABLED_REASON } : undefined);
    const reasons = (() => {
      if (!rawReasons) return undefined;
      if (typeof rawReasons === 'string') {
        return rawReasons === ENTRY_ACTION_DISABLED_REASON ? undefined : rawReasons;
      }
      const cleaned = {
        edit: rawReasons.edit && rawReasons.edit !== ENTRY_ACTION_DISABLED_REASON ? rawReasons.edit : undefined,
        delete: rawReasons.delete && rawReasons.delete !== ENTRY_ACTION_DISABLED_REASON ? rawReasons.delete : undefined,
      };
      if (!cleaned.edit && !cleaned.delete) {
        return undefined;
      }
      return cleaned;
    })();

    return {
      canEdit: canEditFinal,
      canDelete: canDeleteFinal,
      reasons,
    };
  }, [isEntryMessage, isEntrySettled, message, entryCanEdit, entryCanDelete, entryDisabledReason]);

  const shouldDisplayEntryActions = Boolean(resolvedEntryActions);

  // メッセージがレンダリングされた後、画像にクリックイベントを追加
  React.useEffect(() => {
    if (messageRef.current && onImageClick) {
      const images = messageRef.current.querySelectorAll('img[data-image-url]');
      const overlays = messageRef.current.querySelectorAll('.image-overlay');

      const handleClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        let imageUrl = null;
        const target = event.target as HTMLElement;

        // 画像が直接クリックされた場合
        if (target.tagName === 'IMG') {
          imageUrl = (target as HTMLImageElement).getAttribute('data-image-url');
        }
        // オーバーレイやその子要素がクリックされた場合
        else {
          const parentGroup = target.closest('.relative.group');
          if (parentGroup) {
            const img = parentGroup.querySelector('img[data-image-url]') as HTMLImageElement;
            if (img) {
              imageUrl = img.getAttribute('data-image-url');
            }
          }
        }

        if (imageUrl) {
          console.log('画像クリック:', imageUrl);
          onImageClick(imageUrl);
        }
      };

      // 画像とオーバーレイの両方にイベントリスナーを追加
      images.forEach((img) => {
        img.addEventListener('click', handleClick);
      });

      overlays.forEach((overlay) => {
        overlay.addEventListener('click', handleClick);
      });

      // クリーンアップ関数でイベントリスナーを削除
      return () => {
        images.forEach((img) => {
          img.removeEventListener('click', handleClick);
        });
        overlays.forEach((overlay) => {
          overlay.removeEventListener('click', handleClick);
        });
      };
    }
  }, [message.content, onImageClick]);

  const handleMouseEnter = () => {
    if (!ENABLE_CHAT_BUBBLE_EDIT) return;
    if (isEligibleForEdit || canShowUndo || shouldDisplayEntryActions) {
      setShowHoverActions(true);
    }
  };

  const handleMouseLeave = () => {
    if (!ENABLE_CHAT_BUBBLE_EDIT) return;
    setShowHoverActions(false);
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      <div
        className={`relative max-w-[75%] ${isUser ? 'ml-auto' : 'mr-auto'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={messageRef}
          data-message-id={message.id}
          data-testid={(message as any)['data-testid'] || (message.type === 'bot' ? 'bot-message' : 'user-message')}
          className={`relative w-full px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow transition-all duration-300 ${
            isHighlighted
              ? 'ring-2 ring-yellow-400 bg-yellow-50'
              : isUser
                ? 'bg-blue-100 text-[#1E3A8A]'
                : 'bg-white border border-[#E5E7EB] text-[#111827]'
          } ${isDeleting ? 'opacity-0 scale-[0.98]' : 'opacity-100'}`}
          >
          <span dangerouslySetInnerHTML={{ __html: message.content }} />

          {shouldDisplayEntryActions && (
            <EntryMessageActions
              canEdit={resolvedEntryActions!.canEdit}
              canDelete={resolvedEntryActions!.canDelete}
              disabledReason={resolvedEntryActions!.reasons}
              isVisible={showHoverActions}
              onEdit={() => onMessageEdit?.(message)}
              onDelete={() => onEntryDelete?.(message)}
            />
          )}

          {/* Action Icons */}
          {showHoverActions && (isEligibleForEdit || canShowUndo) && (
            <div className="absolute bottom-1 right-1 flex gap-1">
              {/* Edit Icon */}
              {isEligibleForEdit && (
                <button
                  className="w-6 h-6 bg-gray-400 hover:bg-gray-500 text-white rounded-full flex items-center justify-center transition-all opacity-60 hover:opacity-80 shadow-sm z-10"
                  onClick={() => onMessageEdit?.(message)}
                  aria-label="メッセージを編集"
                >
                  <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                  </svg>
                </button>
              )}

              {/* Undo Icon for EXIT messages */}
              {canShowUndo && (
                <button
                  className="w-6 h-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-all opacity-80 hover:opacity-100 shadow-sm z-10"
                  onClick={() => onMessageUndo?.(message)}
                  aria-label="決済を取り消し"
                  title="決済を取り消し"
                >
                  <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"/>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timestamp positioned below bubble - isolated from edit icon */}
      <span className={`mt-1 text-[10px] text-gray-400 ${isUser ? 'self-end' : 'self-start'}`}>
        {message.timestamp}
      </span>
    </div>
  );
};

// Primary Button Variant
const PrimaryButton: React.FC<{ 
  children: React.ReactNode; 
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
}> = ({ children, onClick, className = '', variant = 'primary', disabled = false }) => {
  const baseClass = "h-12 px-6 rounded-lg text-white font-medium transition-colors";
  const variantClass = variant === 'primary' 
    ? 'bg-[#3B82F6] hover:bg-[#2563EB]' 
    : 'bg-[#EF4444] hover:bg-[#DC2626]';
    
  return (
    <Button 
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variantClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </Button>
  );
};

// File Item Component
const FileItem: React.FC<{ name: string; isActive?: boolean; onClick?: () => void }> = ({
  name,
  isActive = false,
  onClick
}) => (
  <button
    onClick={onClick}
    className={`w-full h-10 px-3 text-left text-sm border-b border-[#E5E7EB] transition-colors rounded ${
      isActive
        ? 'bg-blue-100 text-blue-700 font-medium'
        : 'hover:bg-[#F1F5F9] text-[#6B7280]'
    }`}
  >
    {name}
  </button>
);

// Modal Base Component
const ModalBase: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="w-[400px] rounded-[24px] p-6 bg-white shadow-[0_8px_24px_0_rgba(0,0,0,0.1)] z-[9999]">
      <DialogHeader>
        <DialogTitle className="text-base font-semibold text-[#374151]">
          {title}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {title}に関するモーダルダイアログです。
        </DialogDescription>
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
);

interface TradeProps {
  isFileListVisible: boolean;
  selectedFile: string;
  setSelectedFile: (file: string) => void;
}

const Trade: React.FC<TradeProps> = ({ isFileListVisible, selectedFile, setSelectedFile }) => {
  // Hooks first
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State declarations first
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [entryCode, setEntryCode] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
  // Track settled entries by message ID
  const [settledEntries, setSettledEntries] = useState<Set<string>>(() => loadSettledEntriesFromStorage());
  
  // Helper function to mark an ENTRY as settled
  const markEntryAsSettled = (messageId: string) => {
    setSettledEntries(prev => {
      const newSet = new Set(prev);
      newSet.add(messageId);
      console.log(`🔒 DEBUG: Marked ENTRY ${messageId} as settled. Total settled:`, newSet.size);
      return newSet;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const ids = Array.from(settledEntries);
      window.localStorage.setItem(SETTLED_ENTRIES_STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
      console.warn('Failed to persist settled entry IDs to storage:', error);
    }
  }, [settledEntries]);

  // Helper function to check if ENTRY is settled (closed)
  const isEntrySettled = (message: Message): boolean => {
    // Only check for ENTRY messages
    if (!message.content.includes('建値入力しました')) {
      return false;
    }
    
    // Check if this specific message is marked as settled
    if (settledEntries.has(message.id)) {
      console.log(`🔍 DEBUG: Message ${message.id} is explicitly marked as settled`);
      return true;
    }
    
    try {
      // Parse message content to extract entry data
      const content = message.content;
      
      // Extract symbol
      const symbolMatch = content.match(/銘柄:\s*([^\<\<br/\>]+)/);
      const symbol = symbolMatch ? symbolMatch[1].trim() : '';
      if (!symbol) {
        return false;
      }
      
      // Extract position type
      const positionMatch = content.match(/ポジションタイプ:\s*([^\<\<br/\>]+)/);
      const positionText = positionMatch ? positionMatch[1].trim() : '';
      const side = (positionText.includes('ロング') || positionText.includes('LONG')) ? 'LONG' : 'SHORT';
      
      const chatId = undefined; // Will be passed from chat context
      
      // Check if position exists in active positions
      const { long, short } = getLongShortQty(symbol, chatId);
      const currentQty = side === 'LONG' ? long : short;
      
      // Fallback check: Position is settled if qty is 0 and message is older than 5 seconds
      const messageAge = Date.now() - new Date(message.timestamp).getTime();
      const isOldMessage = messageAge > 5000; // 5 seconds
      
      const isSettled = currentQty === 0 && isOldMessage;
      return isSettled;
    } catch (error) {
      console.warn('Error checking if ENTRY is settled:', error);
      return false;
    }
  };
  
  // Chat input state for MessageEditIntegration
  const [chatInput, setChatInput] = useState<string>('');

  // Message editing states
  const [editEntryModal, setEditEntryModal] = useState<{
    isOpen: boolean;
    messageId?: string;
    data?: any;
  }>({ isOpen: false });
  
  const [editExitModal, setEditExitModal] = useState<{
    isOpen: boolean;
    messageId?: string;
    data?: any;
  }>({ isOpen: false });
  
  const [editingTextMessage, setEditingTextMessage] = useState<{
    messageId: string;
    originalText: string;
  } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [entryInitialState, setEntryInitialState] = useState<EntryFormState | null>(null);
  const [entrySymbol, setEntrySymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryPositionType, setEntryPositionType] = useState<'long' | 'short'>('long');
  const [entryChartPattern, setEntryChartPattern] = useState<ChartPattern | ''>('');
  const [entryMemo, setEntryMemo] = useState<string>('');
  const [entryImageFile, setEntryImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string>('');
  const [showChartPatternSelect, setShowChartPatternSelect] = useState<boolean>(false);
  const [showMemoTextarea, setShowMemoTextarea] = useState<boolean>(false);

  // Edit mode tracking for modals
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [entryDeleteState, setEntryDeleteState] = useState<{ isOpen: boolean; target?: Message }>({ isOpen: false });
  const [deletingEntryIds, setDeletingEntryIds] = useState<Set<string>>(new Set());
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const entryDeletePreview = useMemo(() => {
    if (!entryDeleteState.target) return '';
    return entryDeleteState.target.content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }, [entryDeleteState]);

  const isEditingEntry = Boolean(editingMessageId);
  const isEntryFormDirty = useMemo(() => {
    if (!isEditingEntry || !entryInitialState) {
      return true;
    }

    return (
      entrySymbol !== entryInitialState.symbol ||
      entryPositionType !== entryInitialState.side ||
      entryPrice !== entryInitialState.price ||
      entryQuantity !== entryInitialState.qty ||
      entryChartPattern !== entryInitialState.chartPattern ||
      entryMemo !== entryInitialState.memo
    );
  }, [
    isEditingEntry,
    entryInitialState,
    entrySymbol,
    entryPositionType,
    entryPrice,
    entryQuantity,
    entryChartPattern,
    entryMemo,
  ]);

  const isEntrySubmitDisabled =
    isAnalyzing ||
    !!imageError ||
    isUpdating ||
    (isEditingEntry && !isEntryFormDirty);

  // Message editing handlers
  const handleMessageEdit = (message: Message) => {
    if (message.type === 'user' && !message.isTradeAction) {
      // 画像付きメッセージは編集不可
      if (typeof message.content === 'string' && /<img\b|data-image-url=/.test(message.content)) {
        showToast('warning', '画像付きメッセージは編集できません');
        return;
      }
      // Handle regular text message edit
      setEditingTextMessage({
        messageId: message.id,
        originalText: message.content
      });
      setChatInput(message.content);
    } else if (message.isTradeAction) {
      // Handle trade action message edit
      if (message.content.includes('建値入力しました')) {
        // ENTRY message - open entry modal with prefill
        handleEntryEdit(message);
      } else if (includesExitMessage(message.content)) {
        // EXIT message - open exit modal with prefill
        handleExitEdit(message);
      }
    }
  };

  const handleEntryEdit = (message: Message) => {
    console.log('🔧 handleEntryEdit called with message:', message.id);
    console.log('🔧 Original message content:', message.content);
    
    // Parse message content to extract entry data
    // Format: "📈 建値入力しました！<br/>銘柄: SYMBOL<br/>ポジションタイプ: LONG/SHORT<br/>建値: PRICE円<br/>数量: QTY株"
    const content = message.content;
    const plainText = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    
    // Extract symbol
    const symbolMatch = content.match(/銘柄:\s*([^\<\<br/\>]+)/);
    const symbol = symbolMatch ? symbolMatch[1].trim() : '';
    console.log('🔧 Symbol extraction:', { symbolMatch, symbol });
    
    // Extract symbol code and name
    let symbolCode = '';
    let symbolName = '';
    if (symbol.includes(' ')) {
      const parts = symbol.split(' ');
      symbolCode = parts[0];
      symbolName = parts.slice(1).join(' ');
    } else {
      symbolCode = symbol;
      // 銘柄コードから銘柄名を取得する処理が必要な場合はここで実装
    }
    
    // Extract position type
    const positionMatch = content.match(/ポジションタイプ:\s*([^\<\<br/\>]+)/);
    const positionText = positionMatch ? positionMatch[1].trim() : '';
    const isLong = positionText.includes('ロング') || positionText.includes('LONG');
    console.log('🔧 Position extraction:', { positionMatch, positionText, isLong });
    
    // Extract price (remove commas)
    const priceMatch = content.match(/建値:\s*([\d,]+)円/);
    const price = priceMatch ? priceMatch[1].replace(/,/g, '') : '';
    console.log('🔧 Price extraction:', { priceMatch, price });
    
    // Extract quantity (remove commas)
    const qtyMatch = content.match(/数量:\s*([\d,]+)株/);
    const qty = qtyMatch ? qtyMatch[1].replace(/,/g, '') : '';
    console.log('🔧 Quantity extraction:', { qtyMatch, qty });
    
    // Extract chart pattern label
    const patternMatch = plainText.match(/チャートパターン[:：]\s*([^\n]+)/);
    const patternLabel = patternMatch ? patternMatch[1].trim() : '';
    const patternEntry = CHART_PATTERNS.find((p) => p.label === patternLabel);
    const chartPatternValue = patternEntry ? patternEntry.value : undefined;

    // Extract optional memo
    const memoMatch = plainText.match(/(?:📝\s*)?メモ[:：]\s*([^\n]+)/);
    const memoValue = memoMatch ? memoMatch[1].trim() : '';

    console.log('🔧 Setting editingMessageId to:', message.id);
    
    // Use flushSync to ensure state updates are synchronous before opening modal
    flushSync(() => {
      setEditingMessageId(message.id);
    });
    
    // Then prefill the form data
    setEntrySymbol(symbol); // 既存の新規モーダル用
    setEntryPrice(price);
    setEntryQuantity(qty);
    setEntryPositionType(isLong ? 'long' : 'short');
    setEntryChartPattern(chartPatternValue ?? '');
    setShowChartPatternSelect(Boolean(chartPatternValue));
    setEntryMemo(memoValue);
    setShowMemoTextarea(memoValue.length > 0);
    setEntryInitialState({
      symbol,
      side: isLong ? 'long' : 'short',
      price,
      qty,
      chartPattern: chartPatternValue ?? '',
      memo: memoValue,
    });

    // 編集モーダル用のデータ設定
    const editData = {
      symbolCode: symbolCode,
      symbolName: symbolName,
      side: isLong ? 'LONG' : 'SHORT',
      price: parseFloat(price) || 0,
      qty: parseInt(qty) || 0,
      chartPattern: chartPatternValue,
      note: memoValue
    };

    // 編集モーダルの状態を更新
    setEditEntryModal({
      isOpen: true,
      messageId: message.id,
      data: editData
    });
    
    console.log('🔧 Prefilling entry modal:', { 
      messageId: message.id,
      symbol, 
      price, 
      qty, 
      positionType: isLong ? 'long' : 'short',
      editingMessageIdAfterFlushSync: message.id
    });
    
    // Open modal last
    setIsEntryModalOpen(true);
  };

  const handleEntryDeleteRequest = (message: Message) => {
    if (!message.content.includes('建値入力しました')) {
      return;
    }
    setEntryDeleteState({ isOpen: true, target: message });
  };

  const handleConfirmEntryDelete = async () => {
    if (!entryDeleteState.target) return;
    const target = entryDeleteState.target;
    const relatedPlanMessageIds = (() => {
      const linked = messages
        .filter(msg => msg.type === 'bot' && msg.relatedEntryId === target.id)
        .map(msg => msg.id);
      if (linked.length > 0) {
        return Array.from(new Set(linked));
      }
      const targetIndex = messages.findIndex(msg => msg.id === target.id);
      if (targetIndex >= 0) {
        const fallback = messages
          .slice(targetIndex + 1)
          .find(msg => msg.type === 'bot' && typeof msg.content === 'string' && msg.content.includes('🎯 取引プラン設定'));
        if (fallback) {
          return [fallback.id];
        }
      }
      return [] as string[];
    })();
    const pendingPlanEntry = planMessageTimers.current.get(target.id);
    if (pendingPlanEntry) {
      window.clearTimeout(pendingPlanEntry.timeoutId);
      planMessageTimers.current.delete(target.id);
    }

    setIsDeletingEntry(true);
    try {
      const apiUrl = getApiUrl();
      const chatIdentifier = currentChatId || 'default-chat-123';
      const response = await fetch(`${apiUrl}/chats/${chatIdentifier}/messages/${target.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const isNotFound = response.status === 404;

      if (!response.ok && !isNotFound) {
        throw new Error(`Failed to delete entry message: ${response.status}`);
      }

      if (isNotFound) {
        console.warn(`Entry message ${target.id} already deleted on server`);
      }

      setDeletingEntryIds(prev => {
        const next = new Set(prev);
        next.add(target.id);
        relatedPlanMessageIds.forEach(id => next.add(id));
        return next;
      });

      const parsed = parseEntryMessage(target);
      if (parsed) {
        const chatContext = currentChatId || undefined;
        let removed = false;
        if (parsed.price !== undefined && parsed.qty !== undefined) {
          removed = removeEntryLot(
            parsed.symbolCode,
            parsed.side,
            parsed.price,
            parsed.qty,
            chatContext
          );
        }
        if (!removed) {
          storeDeletePosition(parsed.symbolCode, parsed.side, chatContext);
        }
        window.dispatchEvent(new Event('positions-changed'));

        const beforeSnapshot: EntryAuditSnapshot = {
          symbolCode: parsed.symbolCode,
          side: parsed.side,
          price: parsed.price,
          qty: parsed.qty,
          note: auditNote(parsed.note),
          tradeId: parsed.tradeId,
        };

        recordEntryDeleted({
          entryId: target.id,
          before: beforeSnapshot,
          after: null,
          actorId: 'user-1',
          timestamp: new Date().toISOString(),
          regenerateFlag: false,
        });
      }

      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.id !== target.id && !relatedPlanMessageIds.includes(msg.id)));
        setDeletingEntryIds(prev => {
          const next = new Set(prev);
          next.delete(target.id);
          relatedPlanMessageIds.forEach(id => next.delete(id));
          return next;
        });
      }, 320);
      setEntryDeleteState({ isOpen: false });
      showToast('success', '建値メッセージを削除しました');
    } catch (error) {
      console.error('Failed to delete entry message:', error);
      showToast('error', '建値メッセージの削除に失敗しました', '時間をおいて再度お試しください');
      if (pendingPlanEntry) {
        const { message } = pendingPlanEntry;
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }
      setDeletingEntryIds(prev => {
        const next = new Set(prev);
        next.delete(target.id);
        relatedPlanMessageIds.forEach(id => next.delete(id));
        return next;
      });
    } finally {
      setIsDeletingEntry(false);
    }
  };

  const handleExitEdit = (message: Message) => {
    // Parse message content to extract exit data
    // Format: "✅ 約定しました！<br/>銘柄: SYMBOL NAME<br/>ポジションタイプ: LONG/SHORT<br/>決済価格: PRICE円<br/>数量: QTY株"
    const content = message.content;
    
    // Extract symbol
    const symbolMatch = content.match(/銘柄:\s*([^\<\<br/\>]+)/);
    const symbolWithName = symbolMatch ? symbolMatch[1].trim() : '';
    const symbol = symbolWithName.split(' ')[0]; // Take first part as symbol code
    
    // Extract exit price (remove commas)
    const priceMatch = content.match(/決済価格:\s*([\d,]+)円/);
    const price = priceMatch ? priceMatch[1].replace(/,/g, '') : '';
    
    // Extract quantity (remove commas)
    const qtyMatch = content.match(/数量:\s*([\d,]+)株/);
    const qty = qtyMatch ? qtyMatch[1].replace(/,/g, '') : '';
    
    // Extract position type to determine side
    const positionMatch = content.match(/ポジションタイプ:\s*([^\<\<br/\>]+)/);
    const positionText = positionMatch ? positionMatch[1].trim() : '';
    const side = positionText.includes('ロング') || positionText.includes('LONG') ? 'LONG' : 'SHORT';
    
    // Prefill the exit form
    setExitSymbol(symbol);
    setExitPrice(price);
    setExitQuantity(qty);
    setExitSide(side);
    
    // Set edit mode
    setEditingMessageId(message.id);
    
    console.log('Prefilling exit modal:', { symbol, price, qty, side });
    
    setIsExitModalOpen(true);
  };

  const handleCancelTextEdit = () => {
    setEditingTextMessage(null);
    setChatInput('');
  };

  const clearEditMode = () => {
    console.log('🧹 clearEditMode called - clearing editingMessageId');
    setEditingMessageId(null);
    setEntryInitialState(null);
  };

  const handleEntryUpdate = async () => {
    if (!editingMessageId) return;

    const originalMessage = messages.find(msg => msg.id === editingMessageId);
    const originalContent = originalMessage?.content || '';
    const originalParsed = originalMessage ? parseEntryMessage(originalMessage) : null;

    const price = parseFloat(entryPrice);
    const qty = parseInt(entryQuantity, 10);
    const memoValue = entryMemo.trim();
    const memoForPayload = memoValue.length > 0 ? memoValue : undefined;
    const chartPatternValue = entryChartPattern === '' ? undefined : entryChartPattern;
    const patternLabel = chartPatternValue ? CHART_PATTERN_LABEL_MAP[chartPatternValue as ChartPattern] : null;
    const chartPatternLine = patternLabel ? `<br/>チャートパターン: ${patternLabel}` : '';
    const memoLine = memoForPayload ? `<br/>メモ: ${memoForPayload.replace(/\n/g, '<br/>')}` : '';

    if (isNaN(price) || isNaN(qty)) {
      alert('価格と数量を正しく入力してください');
      return;
    }

    if (price <= 0 || qty <= 0) {
      alert('価格と数量は正の数値で入力してください');
      return;
    }

    if (!entrySymbol.trim()) {
      alert('銘柄を入力してください（例: 5803.T）');
      return;
    }

    const positionText = entryPositionType === 'long' ? 'ロング（買い）' : 'ショート（売り）';
    const [symbolCodeRaw, ...symbolNameParts] = entrySymbol.trim().split(/\s+/);
    const symbolCodeForPayload = symbolCodeRaw || originalParsed?.symbolCode || entrySymbol.trim();
    const symbolNameForPayload = symbolNameParts.join(' ') || originalParsed?.symbolCode || symbolCodeForPayload;
    const newContent = `📈 建値入力しました！(編集済み)<br/>銘柄: ${entrySymbol}<br/>ポジションタイプ: ${positionText}<br/>建値: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株${chartPatternLine}${memoLine}`;

    const updatedSide: 'LONG' | 'SHORT' = entryPositionType === 'long' ? 'LONG' : 'SHORT';
    const planConfig = loadTradePlanConfig();
    const priceChanged = originalParsed?.price !== undefined ? originalParsed.price !== price : true;
    const sideChanged = originalParsed?.side !== undefined ? originalParsed.side !== updatedSide : true;
    const qtyChanged = originalParsed?.qty !== undefined ? originalParsed.qty !== qty : true;
    const planTriggerChanged = priceChanged || sideChanged || qtyChanged;
    const planBotMessage = planTriggerChanged
      ? {
          ...createPlanLegacyMessage(price, qty, updatedSide, planConfig, {
            edited: true,
            relatedEntryId: editingMessageId,
          }),
          type: 'bot' as const,
          relatedEntryId: editingMessageId,
        }
      : null;

    const beforeSnapshot: EntryAuditSnapshot | null = originalParsed
      ? {
          symbolCode: originalParsed.symbolCode,
          side: originalParsed.side,
          price: originalParsed.price,
          qty: originalParsed.qty,
          note: auditNote(originalParsed.note),
          tradeId: originalParsed.tradeId,
          chartPattern: originalParsed.chartPattern,
        }
      : null;

    const afterSnapshot: EntryAuditSnapshot = {
      symbolCode: symbolCodeForPayload,
      side: updatedSide,
      price,
      qty,
      note: auditNote(memoForPayload),
      tradeId: originalParsed?.tradeId,
      chartPattern: chartPatternValue,
    };

    const linkedPosition = updatePosition(
      symbolCodeForPayload,
      updatedSide,
      {
        avgPrice: price,
        qtyTotal: qty,
        updatedAt: new Date().toISOString(),
      },
      currentChatId || undefined
    );

    if (linkedPosition) {
      window.dispatchEvent(new Event('positions-changed'));
    }

    setIsUpdating(true);
    setMessages(prev => {
      let next = prev.map(msg => (msg.id === editingMessageId ? { ...msg, content: newContent } : msg));
      if (planBotMessage) {
        let removed = false;
        next = next.filter(candidate => {
          if (candidate.type !== 'bot') {
            return true;
          }
          if (!removed && candidate.relatedEntryId === editingMessageId) {
            removed = true;
            return false;
          }
          if (!removed && typeof candidate.content === 'string' && candidate.content.includes('🎯 取引プラン設定')) {
            removed = true;
            return false;
          }
          return true;
        });
        return [...next, planBotMessage];
      }
      return next;
    });

    if (planBotMessage) {
      setTimeout(() => scrollToLatestMessage(), 50);
    }

    try {
      const updatedChatMessage = await updateChatMessage(editingMessageId, {
        type: 'ENTRY',
        payload: {
          symbolCode: symbolCodeForPayload,
          symbolName: symbolNameForPayload,
          side: entryPositionType === 'long' ? 'LONG' : 'SHORT',
          price,
          qty,
          ...(memoForPayload ? { note: memoForPayload } : {}),
          ...(chartPatternValue ? { chartPattern: chartPatternValue } : {}),
          ...(originalParsed?.tradeId ? { tradeId: originalParsed.tradeId } : {}),
        },
      });

      const tradeMessage = convertChatMessageToTradeMessage(updatedChatMessage);
      tradeMessage.content = tradeMessage.content.replace('📈 建値入力しました！', '📈 建値入力しました！(編集済み)');
      setMessages(prev => prev.map(msg => (msg.id === editingMessageId ? tradeMessage : msg)));

      recordEntryEdited({
        entryId: editingMessageId,
        before: beforeSnapshot,
        after: afterSnapshot,
        actorId: 'user-1',
        timestamp: updatedChatMessage.updatedAt ?? new Date().toISOString(),
        regenerateFlag: planTriggerChanged,
      });

      const chatContext = currentChatId || undefined;

      // Remove previous lots if they existed
      if (originalParsed?.qty && originalParsed.qty > 0 && originalParsed.price !== undefined) {
        removeEntryLot(
          originalParsed.symbolCode,
          originalParsed.side,
          originalParsed.price,
          originalParsed.qty,
          chatContext
        );
      }

      // Apply new entry lots only when qty remains positive
      if (qty > 0) {
        positionsEntry(
          symbolCodeForPayload,
          entryPositionType === 'long' ? 'LONG' : 'SHORT',
          price,
          qty,
          symbolNameForPayload,
          chatContext
        );
      } else {
        storeDeletePosition(
          symbolCodeForPayload,
          entryPositionType === 'long' ? 'LONG' : 'SHORT',
          chatContext
        );
      }

      window.dispatchEvent(new Event('positions-changed'));
    } catch (error) {
      console.error('Failed to update ENTRY message:', error);
      // Keep optimistic update but warn in console for follow-up.
    } finally {
      setIsUpdating(false);
      setIsEntryModalOpen(false);
      clearEditMode();
      setEntryMemo('');
      setEntryChartPattern('');
      setShowChartPatternSelect(false);
      setShowMemoTextarea(false);
    }
  };

  const handleExitUpdate = async () => {
    if (!editingMessageId) return;

    const price = parseFloat(exitPrice);
    const qty = parseInt(exitQuantity, 10);
    
    // バリデーション
    if (isNaN(price) || isNaN(qty)) {
      alert("価格と数量を正しく入力してください");
      return;
    }
    
    if (price <= 0 || qty <= 0) {
      alert("価格と数量は正の数値で入力してください");
      return;
    }

    // 銘柄名を取得（簡易版）
    const symbolName = exitSymbol; // TODO: 実際の銘柄名取得
    const positionText = exitSide === 'LONG' ? 'ロング（買い）' : 'ショート（売り）';
    
    // Update the message content
    const newContent = `✅ 約定しました！<br/>銘柄: ${exitSymbol} ${symbolName}<br/>ポジションタイプ: ${positionText}<br/>決済価格: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株`;
    
    // Update message in state
    setMessages(prev => prev.map(msg => 
      msg.id === editingMessageId 
        ? { ...msg, content: newContent }
        : msg
    ));

    // Call PATCH API to update message on backend
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/chats/default-chat-123/messages/${editingMessageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newContent }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Success - keep the optimistic update
    } catch (error) {
      console.error('Failed to update EXIT message:', error);
      showToast('error', 'メッセージの更新に失敗しました');
      // Revert the optimistic update
      const originalMessage = messages.find(msg => msg.id === editingMessageId);
      const originalContent = originalMessage?.content || '';
      setMessages(prevMessages => prevMessages.map(msg =>
        msg.id === editingMessageId 
          ? { ...msg, content: originalContent }
          : msg
      ));
    }
    
    // Close modal and clear edit mode
    setIsExitModalOpen(false);
    clearEditMode();
    
    console.log('Updated exit message:', { price, qty, symbol: exitSymbol, side: exitSide });
  };

  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());
  const handleMessageUndo = async (message: Message) => {
    if (!message.isTradeAction || typeof message.content !== 'string' || !includesExitMessage(message.content)) return;
    if (undoingIds.has(message.id)) return; // 冪等

    // 時間制限（30分）
    const messageTime = new Date(message.timestamp).getTime();
    const timeDiff = Date.now() - messageTime;
    if (timeDiff > 30 * 60 * 1000) {
      showToast('warning', '決済から30分以上経過しているため、取り消しできません。');
      return;
    }

    // Confirm
    if (!confirm('決済を取り消しますか？')) return;

    setUndoingIds(prev => new Set(prev).add(message.id));

    const exitDetails = parseExitMessageContent(message.content);
    const settlementRecord = getSettlementRecord(message.id);
    const targetSymbolCode = settlementRecord?.symbol ?? exitDetails?.symbolCode;
    const targetSide = settlementRecord?.side ?? exitDetails?.side;
    const reenableEntryActions = () => {
      if (!targetSymbolCode || !targetSide) return;
      clearSettledEntriesFor(targetSymbolCode, targetSide);
      setTimeout(() => {
        refreshEntryActionState();
      }, 100);
    };

    // 事前に、直後の「損益情報」ボットメッセージを特定
    const previous = messages;
    const exitIndex = previous.findIndex(m => m.id === message.id);
    const nextPnlMessageId = exitIndex >= 0
      ? previous.slice(exitIndex + 1).find(m => m.type === 'bot' && typeof m.content === 'string' && m.content.includes('損益情報'))?.id
      : undefined;

    // 楽観的: まずUIから取り除く（EXITバブル） + 画像URLクリーンアップ
    removeMessagesByIds([message.id]);

    try {
      await undoChatMessage(message.id);
      // ポジションを厳密に復元
      try {
        const ok = positionsUnsettle(message.id);
        if (!ok) {
          console.warn('No settlement record found for undo, position not modified');
        } else {
          reenableEntryActions();
        }
      } catch (e) {
        console.warn('Failed to unsettle position after undo:', e);
      }
      // 直後の「損益情報」ボットメッセージも削除（クリーンアップ含む）
      if (nextPnlMessageId) removeMessagesByIds([nextPnlMessageId]);
      showToast('success', 'ポジションを復元しました。');
    } catch (err: any) {
      console.error('Undo failed:', err);
      const msg = String(err?.message || err);
      const isNotFound = /404|not\s*found/i.test(msg);
      if (isNotFound) {
        // サーバー未登録の場合はローカルで復元のみ実施して成功扱い
        const ok = positionsUnsettle(message.id);
        if (ok) {
          // 直後の「損益情報」ボットメッセージも削除（ローカル cleanup）
          if (nextPnlMessageId) removeMessagesByIds([nextPnlMessageId]);
          reenableEntryActions();
          showToast('success', 'ポジションを復元しました。');
        } else {
          // 履歴が無ければ元に戻す
          setMessages(previous);
          showToast('error', '取り消しに失敗しました（履歴なし）');
        }
      } else {
        setMessages(previous); // それ以外はロールバック
        showToast('error', '取り消しに失敗しました');
      }
    } finally {
      setUndoingIds(prev => {
        const n = new Set(prev);
        n.delete(message.id);
        return n;
      });
    }
  };
  
  // 銘柄自動入力関連の状態
  const [symbolInputMode, setSymbolInputMode] = useState<'auto' | 'manual'>('auto');
  const [autoSymbolBadge, setAutoSymbolBadge] = useState(false);
  const [symbolInput, setSymbolInput] = useState('');

  // チャットデータの状態管理
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false); // チャット作成中フラグ
  const refreshEntryActionState = useCallback(() => {
    setMessages(prevMessages => [...prevMessages]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
    }
  }, [setMessages]);
  const clearSettledEntriesFor = useCallback(
    (symbolCode: string, side: 'LONG' | 'SHORT') => {
      const normalizedTarget = normalizeSymbolCode(symbolCode);
      if (!normalizedTarget) return;

      setSettledEntries(prev => {
        if (!prev.size) return prev;

        const next = new Set(prev);
        let changed = false;

        messages.forEach(entryMessage => {
          if (entryMessage.type !== 'user') return;
          if (typeof entryMessage.content !== 'string' || !entryMessage.content.includes('建値入力しました')) return;

          const parsed = parseEntryMessage(entryMessage);
          if (!parsed) return;

          const entryCode = normalizeSymbolCode(parsed.symbolCode);
          if (entryCode && entryCode === normalizedTarget && parsed.side === side) {
            if (next.delete(entryMessage.id)) {
              changed = true;
            }
          }
        });

        return changed ? next : prev;
      });
    },
    [messages, setSettledEntries]
  );
  
  // Restore last selected file on mount
  useEffect(() => {
    const lastFile = localStorage.getItem("lastSelectedFile");
    if (lastFile) {
      setSelectedFile(lastFile);
    }
  }, [setSelectedFile]);

  // Handle URL parameters for chat selection and message highlighting
  useEffect(() => {
    const chatParam = searchParams.get('chat');
    const highlightParam = searchParams.get('highlight');
    
    // Handle chat selection
    if (chatParam && chatParam !== currentChatId) {
      setCurrentChatId(chatParam);
    }
    
    // Handle message highlighting
    if (highlightParam) {
      setHighlightedMessageId(highlightParam);
      
      // Scroll to highlighted message after a short delay to ensure it's rendered
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${highlightParam}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      
      // Clear the highlight parameter after scrolling
      setTimeout(() => {
        setHighlightedMessageId(null);
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('highlight');
        setSearchParams(newSearchParams, { replace: true });
      }, 3000);
    }
  }, [searchParams, setSearchParams, currentChatId]);

  // 銘柄自動入力のhookとロジック
  const { ready: symbolsReady, findByCode } = useSymbolSuggest();
  
  // チャット文脈から銘柄を自動検出・入力する関数
  const updateSymbolFromChat = useCallback(async () => {
    if (symbolInputMode !== 'auto' || !currentChatId || !symbolsReady || !messages || messages.length === 0) return;
    
    try {
      // 銘柄辞書をロード
      const symbolDict = await loadSymbols();
      if (symbolDict.length === 0) {
        console.log('❌ 銘柄辞書が空です');
        return;
      }
      
      // 現在のチャットのメッセージをChatMsg形式に変換（HTMLタグを除去）
      // ユーザー送信メッセージ（通常のチャット + 取引アクション）から銘柄を検出
      const chatMessages: ChatMsg[] = messages
        .filter(msg => msg.type === 'user') // ユーザー送信のメッセージのみ（AIメッセージは除外）
        .map((msg, index) => ({
          id: msg.id,
          chatId: currentChatId,
          text: msg.content.replace(/<[^>]*>/g, ''), // HTMLタグを除去
          createdAt: Date.now() - (messages.length - index - 1) * 1000 // 新しいメッセージほど大きな値
        }));
      
      // 最新の銘柄を検出
      const detectedCode = getLatestSymbolFromChat(chatMessages, symbolDict);
      console.log('🎯 検出された銘柄コード:', detectedCode);
      
      if (detectedCode) {
        const symbolInfo = findByCode(detectedCode);
        if (symbolInfo) {
          const displayText = `${symbolInfo.name}（${symbolInfo.code}）`;
          console.log('✅ 銘柄自動入力:', displayText);
          
          setSymbolInput(displayText);
          setAutoSymbolBadge(true);
          
          // setSelectedFileも更新（既存の動作を維持）
          setSelectedFile(displayText);
        } else {
          console.log('❌ 銘柄情報が見つかりません:', detectedCode);
        }
      } else {
        console.log('❌ 銘柄コードが検出されませんでした');
        // 自動入力状態をクリア
        setSymbolInput('');
        setAutoSymbolBadge(false);
      }
    } catch (error) {
      console.error('❌ 銘柄自動検出エラー:', error);
    }
  }, [symbolInputMode, currentChatId, symbolsReady, messages, findByCode, setSelectedFile]);
  
  // メッセージが追加された時に銘柄を自動検出（少し遅延させてDOM更新後に実行）
  useEffect(() => {
    const timer = setTimeout(() => {
      updateSymbolFromChat();
    }, 200);
    
    return () => clearTimeout(timer);
  }, [updateSymbolFromChat]);
  
  // 自動検出された銘柄をentrySymbolに反映
  useEffect(() => {
    if (symbolInputMode === 'auto' && symbolInput && autoSymbolBadge) {
      setEntrySymbol(symbolInput);
      // コードも抽出してセット
      const codeMatch = symbolInput.match(/（(\d{4})）/);
      if (codeMatch) {
        setEntryCode(codeMatch[1]);
      }
    }
  }, [symbolInput, autoSymbolBadge, symbolInputMode]);

  // 既存のローカルチャットをバックエンドに同期する関数
  const syncLocalChatsToBackend = useCallback(async () => {
    const localChats = chats.filter(chat => chat.id.startsWith('chat_'));
    if (localChats.length === 0) return;

    console.log(`🔄 ${localChats.length}個のローカルチャットをバックエンドに同期中...`);

    for (const localChat of localChats) {
      try {
        const response = await fetch(`${getApiUrl()}/chats/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: localChat.name,
            messages_json: JSON.stringify(localChat.messages || [])
          }),
        });

        if (response.ok) {
          const createdChat = await response.json();
          
          // ローカルチャットを新しいUUIDで置き換え
          setChats(prevChats => prevChats.map(chat => 
            chat.id === localChat.id 
              ? { ...chat, id: createdChat.id }
              : chat
          ));

          // 現在選択中のチャットなら更新
          if (currentChatId === localChat.id) {
            setCurrentChatId(createdChat.id);
            localStorage.setItem("currentChatId", createdChat.id);
          }

          console.log(`✅ ローカルチャット ${localChat.name} を ${createdChat.id} に同期`);
        }
      } catch (error) {
        console.error(`❌ チャット ${localChat.name} の同期エラー:`, error);
      }
    }
  }, [chats, currentChatId]);

  // ローカルチャット同期は手動で必要に応じて実行
  // （無限ループを防ぐため自動実行は削除）

  // ユニークなチャット名を生成する関数
  const generateUniqueChatName = useCallback((existingChats: Chat[]) => {
    // 既存のチャット名から「新規チャット X」の番号を抽出
    const existingNumbers = existingChats
      .map(chat => {
        const match = chat.name.match(/^新規チャット (\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    // 最大番号 + 1 を使用、なければ1
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `新規チャット ${nextNumber}`;
  }, []);

  // 新規チャット作成ハンドラー
  const handleCreateNewChat = useCallback(async () => {
    // 既に作成中の場合は無視
    if (isCreatingChat) {
      console.log('⚠️ チャット作成中のため、新規作成をスキップ');
      return;
    }
    
    setIsCreatingChat(true);
    
    try {
      // 最新のchats状態を使ってユニークな名前を生成
      const currentChats = chats;
      const defaultName = generateUniqueChatName(currentChats);
      console.log('🆕 新規チャット作成開始:', defaultName);
      // バックエンドAPIでチャット作成
      const response = await fetch(`${getApiUrl()}/chats/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: defaultName,
          messages_json: JSON.stringify([])
        }),
      });

      if (!response.ok) {
        throw new Error(`チャット作成に失敗しました: ${response.status}`);
      }

      const createdChat = await response.json();
      console.log('✅ バックエンドでチャット作成成功:', createdChat);

      const newChat: Chat = {
        id: createdChat.id, // バックエンドから返されたUUID
        name: createdChat.name,
        messages: [],
        updatedAt: createdChat.updated_at
      };
      
      setChats(prevChats => [newChat, ...prevChats]);
      setCurrentChatId(createdChat.id);
      setSelectedFile(createdChat.name);
      setMessages([]);
      
      // localStorageに保存
      localStorage.setItem("lastSelectedFile", createdChat.name);
      localStorage.setItem("currentChatId", createdChat.id);
      
      console.log('✨ New chat created with Backend ID:', createdChat.id);
      
    } catch (error) {
      console.error('❌ チャット作成エラー:', error);
      showToast('error', 'チャット作成に失敗しました', 'サーバーへの接続に問題があります');
      
      // エラー時はローカルのみでチャット作成（フォールバック）
      const fallbackId = `chat_${Date.now()}`;
      const fallbackName = generateUniqueChatName();
      const newChat: Chat = {
        id: fallbackId,
        name: fallbackName,
        messages: [],
        updatedAt: new Date().toISOString()
      };
      
      setChats(prevChats => [newChat, ...prevChats]);
      setCurrentChatId(fallbackId);
      setSelectedFile(fallbackName);
      setMessages([]);
      
      localStorage.setItem("lastSelectedFile", fallbackName);
      localStorage.setItem("currentChatId", fallbackId);
      
      console.log('⚠️ Fallback to local chat creation:', fallbackId);
    } finally {
      setIsCreatingChat(false);
    }
  }, [generateUniqueChatName, chats, showToast, isCreatingChat]);

  // チャット選択ハンドラー
  const handleSelectChat = (chatId: string) => {
    const selectedChat = chats.find(chat => chat.id === chatId);
    if (selectedChat) {
      setCurrentChatId(chatId);
      setSelectedFile(selectedChat.name);
      setMessages(selectedChat.messages || []);
      
      // チャット切り替え時に銘柄入力状態をリセット
      if (symbolInputMode === 'auto') {
        setSymbolInput('');
        setAutoSymbolBadge(false);
      }
      
      localStorage.setItem("lastSelectedFile", selectedChat.name);
      localStorage.setItem("currentChatId", chatId);
    }
  };

  // チャット名編集ハンドラー
  const handleEditChatName = (chatId: string, newName: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, name: newName, updatedAt: new Date().toISOString() }
          : chat
      )
    );
    
    // 現在選択中のチャットなら、selectedFileも更新
    if (currentChatId === chatId) {
      setSelectedFile(newName);
      localStorage.setItem("lastSelectedFile", newName);
    }
  };

  // チャット削除ハンドラー（楽観的更新）
  const handleDeleteChat = async (chatIdToDelete: string): Promise<void> => {
    // 楽観的更新: まずUIから即座に除去
    const chatToDelete = chats.find(chat => chat.id === chatIdToDelete);
    if (!chatToDelete) return;

    // 削除前の状態を保存（エラー時のロールバック用）
    const originalChats = [...chats];
    const wasCurrentChat = currentChatId === chatIdToDelete;

    // UIから即座に削除
    const remainingChats = chats.filter(chat => chat.id !== chatIdToDelete);
    setChats(remainingChats);

    // 削除対象が現在表示中なら、別のチャットに遷移
    if (wasCurrentChat && remainingChats.length > 0) {
      // 直近の別チャット（リストの先頭）に遷移
      const nextChat = remainingChats[0];
      setCurrentChatId(nextChat.id);
      setSelectedFile(nextChat.name);
      setMessages(nextChat.messages || []);
      localStorage.setItem("lastSelectedFile", nextChat.name);
      localStorage.setItem("currentChatId", nextChat.id);
    } else if (wasCurrentChat) {
      // 削除するチャットが最後のチャットだった場合
      setCurrentChatId(null);
      setSelectedFile('');
      setMessages([]);
      localStorage.removeItem("lastSelectedFile");
      localStorage.removeItem("currentChatId");
    }

    try {
      // サーバーに削除リクエスト（ソフトデリート）
      const response = await fetch(`${getApiUrl()}/chats/${chatIdToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`削除リクエストが失敗しました: ${response.status}`);
      }

      // 成功時はlocalStorageも更新
      localStorage.setItem("allChats", JSON.stringify(remainingChats));
      
    } catch (error) {
      console.error('チャット削除API呼び出しエラー:', error);
      
      // エラー時: ロールバック
      setChats(originalChats);
      
      if (wasCurrentChat) {
        // 元のチャットに戻す
        setCurrentChatId(chatIdToDelete);
        setSelectedFile(chatToDelete.name);
        setMessages(chatToDelete.messages || []);
        localStorage.setItem("lastSelectedFile", chatToDelete.name);
        localStorage.setItem("currentChatId", chatIdToDelete);
      }
      
      throw error; // 呼び出し元でエラーハンドリング
    }
  };
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [exitSymbol, setExitSymbol] = useState<string>('');
  const [exitSide, setExitSide] = useState<'LONG'|'SHORT'|''>('');
  const [exitPrice, setExitPrice] = useState('');
  const [exitQuantity, setExitQuantity] = useState('');
  const [exitChatId, setExitChatId] = useState<string>('');
  
  // 画像拡大モーダルの状態
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  
  // モーダル内画像アップロード関連の状態
  const [entryImagePreview, setEntryImagePreview] = useState<string>('');
  const [exitImageFile, setExitImageFile] = useState<File | null>(null);
  const [exitImagePreview, setExitImagePreview] = useState<string>('');
  const [showExitMemo, setShowExitMemo] = useState<boolean>(false);
  const [exitMemo, setExitMemo] = useState<string>('');
  const exitMemoRef = useRef<HTMLTextAreaElement | null>(null);
  

  // 画像クリック時の処理
  const handleImageClick = (imageUrl: string) => {
    console.log('🖼️ 画像クリック処理:', imageUrl);
    console.log('🖼️ Modal状態変更前:', { imageModalOpen, selectedImageUrl });
    setSelectedImageUrl(imageUrl);
    setImageModalOpen(true);
    console.log('🖼️ Modal状態変更後（予定）:', { imageModalOpen: true, selectedImageUrl: imageUrl });
  };

  // 画像モーダルを閉じる処理
  const closeImageModal = () => {
    setImageModalOpen(false);
    setSelectedImageUrl('');
  };

  // グローバル関数としてwindowオブジェクトに登録
  useEffect(() => {
    (window as any).handleImageClick = handleImageClick;
    return () => {
      delete (window as any).handleImageClick;
    };
  }, []);

  // モーダル状態の変更を監視
  useEffect(() => {
    console.log('🖼️ Modal状態が変更されました:', { imageModalOpen, selectedImageUrl });
  }, [imageModalOpen, selectedImageUrl]);

  useEffect(() => {
    if (showExitMemo && exitMemoRef.current) {
      exitMemoRef.current.focus();
    }
  }, [showExitMemo]);
  
  // 現在の建値を記録する状態（決済時に参照用）
  const [currentEntryPrice, setCurrentEntryPrice] = useState<number>(0);
  
  // 画像バリデーション関数
  const validateImage = (file: File): { ok: boolean; message?: string } => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return { ok: false, message: 'png / jpg / jpeg / webp のみアップロードできます' };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, message: 'ファイルサイズは10MB以下にしてください' };
    }
    return { ok: true };
  };
  
  // プレビューURL作成・削除関数
  const makePreviewURL = (file: File): string => {
    return URL.createObjectURL(file);
  };
  
  const revokePreviewURL = (url: string) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  };

  const handleEntryImageChange = (file: File | null) => {
    if (entryImagePreview) {
      revokePreviewURL(entryImagePreview);
    }

    if (!file) {
      setEntryImageFile(null);
      setEntryImagePreview('');
      setImageError('');
      return;
    }

    const previewUrl = makePreviewURL(file);
    setEntryImageFile(file);
    setEntryImagePreview(previewUrl);
    setImageError('');
  };

  const handleEntryImageError = (reason: 'type' | 'size' | 'other') => {
    const messages: Record<typeof reason, string> = {
      type: 'png / jpeg 以外はアップロードできません',
      size: 'ファイルサイズは10MB以下にしてください',
      other: '画像アップロードに失敗しました',
    };
    setImageError(messages[reason]);
  };
  
  // 画像解析と結果投稿関数
  const analyzeAndPostImage = async (file: File, context: 'ENTRY' | 'EXIT', symbolInfo?: string) => {
    if (!currentChatId) return;
    
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chat_id', currentChatId);
      
      // 銘柄情報があれば追加（建値・決済時の銘柄名を渡す）
      if (symbolInfo) {
        formData.append('symbol_context', symbolInfo);
        formData.append('analysis_context', context === 'ENTRY' ? '建値エントリー' : '決済エグジット');
      }
      
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/advice`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`解析APIエラー: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      // 解析結果カードを少し遅延して投稿（既存メッセージの後に表示されるよう）
      setTimeout(() => {
        const contextLabel = context === 'ENTRY' ? '建値分析' : '決済分析';
        const analysisCard = `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 8px 0; background: #f9fafb;">
          <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px;">📊 ${contextLabel}結果</div>
          <div style="font-size: 13px; line-height: 1.5;">
            ${data.message || '解析結果を取得できませんでした'}
          </div>
        </div>
        `;
        
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'bot' as const,
            content: analysisCard,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
        
        setTimeout(() => scrollToLatestMessage(), 50);
      }, 300); // 300ms遅延で順序を保証
      
    } catch (error) {
      console.error('画像解析エラー:', error);
      // エラー時はサイレント（ユーザーには表示しない）
    } finally {
      setIsAnalyzing(false);
    }
  };
  

  // Chat messages state moved to top of component

  // Modal open -> auto-fill latest symbol from chat context (但し編集モードでは無効)
  useEffect(() => {
    if (!isEntryModalOpen) return;

    if (editingMessageId) {
      return;
    }
    
    setShowChartPatternSelect(false);
    setEntryChartPattern('');
    setShowMemoTextarea(false);
    setEntryMemo('');
    setEntryInitialState(null);

    // まずすべてのフィールドをクリア（新規入力の場合のみ）
    setEntrySymbol('');
    setEntryCode('');
    setEntryPrice('');
    setEntryQuantity('');
    setEntryPositionType('long');
    setAutoFilled(false);
    (async () => {
      try {
        // メッセージがない場合は早期リターン
        if (messages.length === 0) {
          setAutoFilled(false);
          return;
        }

        const dict = await fetch('/data/symbols.json').then(r => r.json()).catch(() => []);
        console.log('📚 銘柄辞書を読み込み:', dict.length, '件');
        console.log('📚 辞書サンプル:', dict.slice(0, 3));

        const msgs: ChatMsg[] = messages
          .filter(m => m.type === 'user') // ユーザー送信のメッセージのみ（AIメッセージは除外）
          .map((m, idx) => ({
            id: m.id,
            chatId: currentChatId || 'default',
            text: m.content.replace(/<[^>]*>/g, ''), // strip simple HTML tags
            createdAt: Date.now() - (messages.length - idx - 1) * 1000, // 新しいメッセージほど大きな値
          }));

        console.log('🔎 変換されたメッセージ:', msgs.map(m => ({ 
          text: m.text.substring(0, 50) + '...', 
          createdAt: m.createdAt 
        })));

        const code = getLatestSymbolFromChat(msgs, dict);
        console.log('🎯 検出された銘柄コード:', code);
        
        if (code) {
          const it = (dict as any[]).find((d: any) => d.code === code);
          console.log('📈 見つかった銘柄情報:', it);
          if (it) {
            setEntrySymbol(`${it.code} ${it.name}`);
            setEntryCode(it.code);
            setAutoFilled(true);
            console.log('✅ 自動入力完了:', `${it.code} ${it.name}`);
          }
        } else {
          console.log('❌ 銘柄が検出されませんでした');
          setAutoFilled(false);
        }
      } catch (error) {
        console.error('❌ 自動入力中にエラー:', error);
      }
    })();
  }, [isEntryModalOpen, editingMessageId]);

  // --- Load chats and current chat from localStorage on mount ---
  useEffect(() => {
    const savedChats = localStorage.getItem("allChats");
    const savedCurrentChatId = localStorage.getItem("currentChatId");
    
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats);
      
      // 以前選択していたチャットがあれば復元
      if (savedCurrentChatId) {
        const currentChat = parsedChats.find((chat: Chat) => chat.id === savedCurrentChatId);
        if (currentChat) {
          setCurrentChatId(savedCurrentChatId);
          setSelectedFile(currentChat.name);
          setMessages(currentChat.messages || []);
        }
      }
    } else {
      // 初回起動時、チャットがない場合はデフォルトチャットを作成
      // 依存関係を回避するため、ここで直接実行
      (async () => {
        const defaultName = `新規チャット 1`;
        
        try {
          const response = await fetch(`${getApiUrl()}/chats/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: defaultName,
              messages_json: JSON.stringify([])
            }),
          });

          if (response.ok) {
            const createdChat = await response.json();
            const newChat: Chat = {
              id: createdChat.id,
              name: createdChat.name,
              messages: [],
              updatedAt: createdChat.updated_at
            };
            
            setChats([newChat]);
            setCurrentChatId(createdChat.id);
            setSelectedFile(createdChat.name);
            setMessages([]);
            
            localStorage.setItem("lastSelectedFile", createdChat.name);
            localStorage.setItem("currentChatId", createdChat.id);
          } else {
            throw new Error('Backend unavailable');
          }
        } catch (error) {
          // フォールバック
          const fallbackId = `chat_${Date.now()}`;
          const newChat: Chat = {
            id: fallbackId,
            name: defaultName,
            messages: [],
            updatedAt: new Date().toISOString()
          };
          
          setChats([newChat]);
          setCurrentChatId(fallbackId);
          setSelectedFile(defaultName);
          setMessages([]);
          
          localStorage.setItem("lastSelectedFile", defaultName);
          localStorage.setItem("currentChatId", fallbackId);
        }
      })();
    }
  }, []); // 空の依存配列

  // --- Save all chats to localStorage whenever chats change ---
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("allChats", JSON.stringify(chats));
    }
  }, [chats]);

  // --- Handle settle modal from card ---
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setExitSymbol(d.symbol || '');
      setExitSide(d.side || '');
      setExitQuantity(String(d.maxQty ?? ''));
      setExitChatId(d.chatId || '');
      setIsExitModalOpen(true);
    };
    window.addEventListener('open-settle-from-card', h as EventListener);
    return () => window.removeEventListener('open-settle-from-card', h as EventListener);
  }, []);
  
  // Chat container ref for scrolling
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const planMessageTimers = useRef<Map<string, { timeoutId: number; message: Message }>>(new Map());
  useEffect(() => {
    return () => {
      planMessageTimers.current.forEach(({ timeoutId }) => window.clearTimeout(timeoutId));
      planMessageTimers.current.clear();
    };
  }, []);
  
  // Scroll to bottom to show latest message
  const scrollToLatestMessage = () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  // --- Helper: revoke blob: object URLs embedded in message HTML when removing messages ---
  const getBlobUrlsFromHtml = (html: string): string[] => {
    const urls: string[] = [];
    try {
      const re = /data-image-url=\"([^\"]+)\"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const u = m[1];
        if (u && u.startsWith('blob:')) urls.push(u);
      }
    } catch {}
    return urls;
  };

  const removeMessagesByIds = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const toRemove = messages.filter(m => ids.includes(m.id));
    const urls = toRemove.flatMap(m => typeof m.content === 'string' ? getBlobUrlsFromHtml(m.content) : []);
    setMessages(prev => prev.filter(m => !ids.includes(m.id)));
    setSettledEntries(prev => {
      if (!prev.size) return prev;
      const next = new Set(prev);
      let changed = false;
      ids.forEach(id => {
        if (next.delete(id)) {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    if (urls.length) setTimeout(() => { urls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} }); }, 0);
  };

  useEffect(() => {
    // メッセージが追加されたら最新メッセージを表示（DOM更新後に実行）
    setTimeout(() => {
      scrollToLatestMessage();
    }, 100);
  }, [messages]);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);

  // Image preview helpers
  const MAX_FILES = 3;
  const ACCEPTED: ChatImageType[] = ['image/png', 'image/jpeg', 'image/webp'];
  const formatBytes = (b: number) => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/(1024*1024)).toFixed(1)}MB`;
  const addPreviewImages = (files: FileList | null) => {
    if (!files) return;
    const current = pendingImages;
    const next: ChatImage[] = [];
    for (const file of Array.from(files)) {
      const type = file.type as ChatImageType;
      if (!ACCEPTED.includes(type)) { showToast('warning', 'サポート外の形式です（png/jpeg/webp のみ）'); continue; }
      if (file.size > 10 * 1024 * 1024) { showToast('warning', 'ファイルサイズは10MB以下にしてください'); continue; }
      if (current.length + next.length >= MAX_FILES) { showToast('warning', `添付は最大${MAX_FILES}枚までです`); break; }
      const dup = current.concat(next).some(p => p.file.name === file.name && p.size === file.size);
      if (dup) continue;
      const url = URL.createObjectURL(file);
      next.push({ id: crypto.randomUUID(), file, url, size: file.size, type });
    }
    if (next.length) setPendingImages(prev => [...prev, ...next]);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { addPreviewImages(e.target.files); e.target.value=''; };
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => { const fl = e.clipboardData?.files; if (fl && fl.length) addPreviewImages(fl); };
  const removePreview = (id: string) => { setPendingImages(prev => { prev.forEach(p => { if (p.id===id) URL.revokeObjectURL(p.url); }); return prev.filter(p => p.id!==id); }); };
  const storageKey = `chatMessages_${selectedFile || 'default'}`;

  // Save messages to current chat whenever messages change
  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === currentChatId 
            ? { 
                ...chat, 
                messages: messages,
                updatedAt: new Date().toISOString()
              }
            : chat
        )
      );
    }
  }, [messages, currentChatId]);


  // ファイルアップロード処理（エラーハンドリング改善版 & ローディング追加）
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleFileUpload 発火", event.target.files?.[0]);
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input to allow re-uploading the same file
    event.target.value = '';

    try {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'bot' as const,
            content: '⚠️ 画像ファイルのみアップロードできます。別のファイルを選択してください。',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'bot' as const,
            content: '⚠️ ファイルサイズが大きすぎます。10MB以下の画像を選択してください。',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
        return;
      }

      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      // チャットIDを追加
      if (currentChatId) {
        formData.append('chat_id', currentChatId);
      }
      
      console.log("✅ /advice エンドポイントにPOST送信");
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/advice`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`アップロードに失敗しました (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      console.log("✅ サーバーからのレスポンスデータ:", data);
      const fileUrl = URL.createObjectURL(file);
      
      // 1. まずユーザーがアップロードした画像を表示
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'user' as const,
          content: `
            <div class="relative group" onclick="window.handleImageClick && window.handleImageClick('${fileUrl}')">
              <img src="${fileUrl}" alt="アップロード画像" class="max-w-[300px] rounded cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md" data-image-url="${fileUrl}"/>
              <div class="image-overlay absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 rounded cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span class="text-white text-sm bg-black bg-opacity-60 px-2 py-1 rounded pointer-events-none">🔍 クリックで拡大</span>
              </div>
            </div>
          `,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      
      // スクロールを最新メッセージに移動
      setTimeout(() => scrollToLatestMessage(), 50);
      
      // 画像から銘柄名が抽出された場合、チャット名を更新
      if (data.extracted_stock_name && currentChatId) {
        const currentChat = chats.find(chat => chat.id === currentChatId);
        if (currentChat && currentChat.name.startsWith('新規チャット')) {
          console.log("✅ 画像から銘柄名を抽出:", data.extracted_stock_name);
          handleEditChatName(currentChatId, data.extracted_stock_name);
        }
      }
      
      // 2. 少し遅延してからAI回答を表示（現在のチャットのみ）
      setTimeout(async () => {
        if (currentChatId) {
          const adviceHtml = await marked.parse(data.message || "解析結果が空です。");
          
          setMessages(prev => {
            const newMessages = [
              ...prev,
              {
                id: crypto.randomUUID(),
                type: 'bot' as const,
                content: adviceHtml,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
            ];
            // Keep only the latest 300 messages
            if (newMessages.length > 300) {
              return newMessages.slice(newMessages.length - 300);
            }
            return newMessages;
          });
          
          // スクロールを最新メッセージに移動
          setTimeout(() => scrollToLatestMessage(), 50);
        }
      }, 500); // 500ms遅延
    } catch (err: any) {
      console.error("❌ ファイルアップロードまたは解析中のエラー:", err);
      let errorMessage = "⚠️ 不明なエラーが発生しました。再度試しても改善しない場合はサポートにご連絡ください。";

      // Parse error response if it's a JSON string
      let parsedError = err;
      if (typeof err.message === 'string' && err.message.includes('{')) {
        try {
          const jsonMatch = err.message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            if (errorData.error && errorData.error.message) {
              parsedError = { ...err, message: errorData.error.message };
            }
          }
        } catch (parseErr) {
          // Continue with original error
        }
      }

      // Handle specific error types without crashing the app
      if (parsedError.name === 'TypeError' && parsedError.message?.includes("Failed to fetch")) {
        errorMessage = "🌐 サーバーに接続できません。バックエンドが起動していることを確認してください。";
      } else if (parsedError.message?.includes("unsupported image")) {
        errorMessage = "⚠️ このファイル形式はサポートされていません。png または jpeg 形式の画像を選択してください。";
      } else if (parsedError.message?.includes("HTTP 500")) {
        errorMessage = "🔧 サーバーエラー: 一時的な障害が発生しています。しばらく待ってから再試行してください。";
      } else if (parsedError.message?.includes("HTTP 404")) {
        errorMessage = "❓ アップロードエンドポイントが見つかりません。システム管理者にお問い合わせください。";
      } else if (parsedError.message?.toLowerCase().includes("incorrect api key") || 
                 parsedError.message?.includes("invalid_api_key") ||
                 parsedError.message?.includes("API key")) {
        errorMessage = "🔑 OpenAI APIキーが設定されていないか無効です。システム管理者にAPIキーの設定を確認してください。";
      } else if (parsedError.message?.toLowerCase().includes("openai")) {
        errorMessage = "⚠️ OpenAI APIでエラーが発生しました。しばらく待ってから再度お試しください。";
      }

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'bot' as const,
          content: errorMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() && pendingImages.length === 0) return;
    if (isSending) return;
    setIsSending(true);

    const userMessage = chatInput.trim();
    
    // Check if we are in edit mode
    if (editingTextMessage) {
      // 新仕様: 元メッセージは残し、編集内容を新しいユーザーバブルとして追加
      try {
        setIsUpdating(true);

        // 1) まずローカルに新しいユーザーバブルを追加（楽観的）
        const tempId = crypto.randomUUID();
        const optimisticUser = {
          id: tempId,
          type: 'user' as const,
          content: userMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, optimisticUser]);

        // 2) サーバーにTEXTとして新規作成（元メッセージは触らない）
        const chatForApi = currentChatId || 'default-chat-123';
        const created = await createChatMessage(chatForApi, {
          type: 'TEXT',
          author_id: 'user-1',
          text: userMessage,
        });

        // 3) サーバーIDで置換
        const tradeMsg = convertChatMessageToTradeMessage(created);
        setMessages(prev => prev.map(m => (m.id === tempId ? tradeMsg : m)));

        // 4) 新規メッセージを基点にAI再生成→直下に追加
        try {
          let ai = await generateAIReply(chatForApi, created.id);
          if (!ai?.response && chatForApi !== 'default-chat-123') {
            ai = await generateAIReply('default-chat-123', created.id);
          }
          if (ai?.response) {
            setMessages(prev => [
              ...prev,
              {
                id: ai.aiMessageId || crypto.randomUUID(),
                type: 'bot' as const,
                content: ai.response,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
            ]);
            setTimeout(() => scrollToLatestMessage(), 50);
          }
        } catch (aiErr) {
          console.warn('AI再生成に失敗:', aiErr);
        }
      } catch (err) {
        // ロールバック（追加した楽観的新規バブルを削除）
        setMessages(prev => prev.slice(0, -1));
      showToast('error', 'メッセージの更新に失敗しました');
      } finally {
        setIsUpdating(false);
        setEditingTextMessage(null);
        setChatInput('');
      }
      return;
    }
    
    // 新しいメッセージ（楽観的追加）
    const tempId = crypto.randomUUID();
    const galleryHtml = pendingImages.length > 0
      ? `<div class=\"flex gap-2 flex-wrap mb-2\">${pendingImages.map(img => `<img src=\"${img.url}\" alt=\"添付画像\" class=\"w-24 h-24 object-cover rounded-lg border\" data-image-url=\"${img.url}\" />`).join('')}</div>`
      : '';
    const contentHtml = `${galleryHtml}${userMessage ? `<div>${userMessage}</div>` : ''}`;
    const newUserMessage = {
      id: tempId,
      type: 'user' as const,
      content: contentHtml || '(画像)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setTimeout(() => scrollToLatestMessage(), 50);
    setChatInput('');

    // バックエンドにもTEXTメッセージを保存（編集用のID付与）
    try {
      const chatForApi = currentChatId || 'default-chat-123';
      const created = await createChatMessage(chatForApi, {
        type: 'TEXT',
        author_id: 'user-1',
        text: pendingImages.length > 0 ? `${userMessage || ''} [画像${pendingImages.length}枚]` : userMessage,
      } as any);
      // 返却メッセージで置き換え（ID同期）
      const tradeMsg = convertChatMessageToTradeMessage(created);
      setMessages(prev => prev.map(m => (
        m.id === tempId
          // 画像を表示中のメッセージはコンテンツを保持し、IDのみサーバーIDへ差し替え
          ? (pendingImages.length > 0 ? { ...m, id: tradeMsg.id } : tradeMsg)
          : m
      )));
    } catch (e) {
      console.warn('TEXTメッセージの保存に失敗（ローカルのみ）:', e);
      // 失敗してもUIは維持（後で編集できない可能性あり）
    }
    
    // 現在のチャットが「新規チャット」で始まる場合、銘柄名を抽出して名前を更新
    if (currentChatId) {
      const currentChat = chats.find(chat => chat.id === currentChatId);
      if (currentChat && currentChat.name.startsWith('新規チャット')) {
        const stockName = extractStockName(userMessage);
        if (stockName) {
          const newName = stockName;
          handleEditChatName(currentChatId, newName);
        }
      }
    }

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          chat_id: currentChatId 
        }),
      });

      if (!res.ok) throw new Error(`質問送信に失敗しました (HTTP ${res.status})`);
      const data = await res.json();

      // 現在のチャットに対する回答のみ表示
      if (currentChatId) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'bot' as const,
            content: data.message || "回答が見つかりませんでした。",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
        setTimeout(() => scrollToLatestMessage(), 50);
      }
    } catch (error) {
      console.error("⚠️ バックエンド未接続またはエラー:", error);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'bot' as const,
          content: "⚠️ 現在AIサーバーに接続できませんが、メッセージは送信されました。",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      setTimeout(() => scrollToLatestMessage(), 50);
    } finally {
      // 入力クリア。タイムラインで表示している画像のObjectURLは維持（破棄しない）
      // TODO: メッセージ削除時にURL.revokeObjectURLを行う
      setChatInput('');
      setPendingImages([]);
      setIsSending(false);
    }
  };


  const handleEntrySubmit = async () => {
    // Check if we're in edit mode
    if (editingMessageId) {
      await handleEntryUpdate();
      return;
    }

    // 画像バリデーションエラーがある場合は送信を阫止
    if (imageError) {
      alert('画像アップロードにエラーがあります。修正してから送信してください。');
      return;
    }
    
    const price = parseFloat(entryPrice);
    const qty = parseInt(entryQuantity, 10);
    
    // バリデーション
    if (isNaN(price) || isNaN(qty)) {
      alert("価格と数量を正しく入力してください");
      return;
    }
    
    if (price <= 0 || qty <= 0) {
      alert("価格と数量は正の数値で入力してください");
      return;
    }

    if (!entrySymbol.trim()) {
      alert('銘柄を入力してください（例: 5803.T）');
      return;
    }

    console.log('Entry:', { 
      price: price, 
      quantity: qty, 
      positionType: entryPositionType,
      currentChatId: currentChatId,
      symbol: entrySymbol
    });

    const planConfig = loadTradePlanConfig();

    // ポジションタイプの表示用文字列
    const positionText = entryPositionType === 'long' ? 'ロング（買い）' : 'ショート（売り）';
    const entrySide: 'LONG' | 'SHORT' = entryPositionType === 'long' ? 'LONG' : 'SHORT';

    // 現在の建値を保存（決済時に使用）
    setCurrentEntryPrice(price);

    const memoValue = entryMemo.trim();
    const memoForPayload = memoValue.length > 0 ? memoValue : undefined;
    const chartPatternValue = entryChartPattern === '' ? undefined : entryChartPattern;
    const patternLabel = chartPatternValue ? CHART_PATTERN_LABEL_MAP[chartPatternValue as ChartPattern] : null;
    const chartPatternLine = patternLabel ? `<br/>チャートパターン: ${patternLabel}` : '';
    const memoLine = memoForPayload ? `<br/>メモ: ${memoForPayload.replace(/\n/g, '<br/>')}` : '';
    const fallbackEntryContent = `📈 建値入力しました！<br/>銘柄: ${entrySymbol}<br/>ポジションタイプ: ${positionText}<br/>建値: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株${chartPatternLine}${memoLine}`;
    const createFallbackEntryMessage = (): Message => {
      const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `local-entry-${crypto.randomUUID()}`
        : `local-entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return {
        id,
        type: 'user',
        isTradeAction: true,
        content: fallbackEntryContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    };
    const entryPayload = {
      symbolCode: entrySymbol,
      symbolName: entrySymbol, // TODO: 実際の銘柄名を取得
      side: entrySide,
      price: price,
      qty: qty,
      executedAt: new Date().toISOString(),
      tradeId: crypto.randomUUID(),
      chartPattern: chartPatternValue,
      ...(memoForPayload ? { note: memoForPayload } : {}),
    };

    // ENTRY メッセージをチャットAPIに送信
    let entryMessageForTimeline: Message | null = null;
    try {
      const apiUrl = getApiUrl();

      const entryMessage = {
        type: "ENTRY",
        author_id: "user-1",
        payload: entryPayload
      };

      const response = await fetch(`${apiUrl}/chats/default-chat-123/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entryMessage)
      });

      if (response.ok) {
        const newMessage = await response.json();
        entryMessageForTimeline = convertChatMessageToTradeMessage(newMessage);
      } else {
        console.error('Failed to create ENTRY message:', response.statusText);
        entryMessageForTimeline = createFallbackEntryMessage();
      }
    } catch (error) {
      console.error('Error creating ENTRY message:', error);
      entryMessageForTimeline = createFallbackEntryMessage();
    }

    if (!entryMessageForTimeline) {
      entryMessageForTimeline = createFallbackEntryMessage();
    }

    setMessages(prev => [...prev, entryMessageForTimeline]);
    const entryMessageId = entryMessageForTimeline.id;
    
    // 画像が添付されている場合、統合分析を実行
    // 成功した場合のみ初回エントリーのポジションにチャート画像IDを紐付け
    let attachChart: { imageId: string } | null = null;
    const symbolCodeForPosition = entryCode || entrySymbol.split(' ')[0];
    const preQty = getLongShortQty(symbolCodeForPosition, currentChatId);
    const isInitialForSide = (entryPositionType === 'long' ? preQty.long : preQty.short) === 0;
    if (entryImageFile) {
      // 統合分析を実行
      try {
        setIsAnalyzing(true);
        
        // 統合分析APIに送信
        const formData = new FormData();
        formData.append('file', entryImageFile);
        formData.append('symbol', entrySymbol || '');
        formData.append('entry_price', price.toString());
        formData.append('position_type', entryPositionType === 'LONG' ? 'long' : 'short');
        formData.append('analysis_context', `建値入力: ${entrySymbol} ${positionText} ${price}円 ${qty}株`);
        if (currentChatId) {
          formData.append('chat_id', currentChatId);
        }

        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/v1/integrated-analysis`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const analysisData = await response.json();
          if (analysisData.success && analysisData.natural_feedback) {
            // 統合分析結果をチャットに追加
            setTimeout(() => {
              setMessages(prev => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  type: 'bot' as const,
                  content: analysisData.natural_feedback,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
              ]);
            }, 1000); // 建値入力メッセージの後に表示

            // 初回エントリーかつAI成功時のみ、後でポジションに画像IDを紐付け
            if (isInitialForSide) {
              attachChart = { imageId: `img-${crypto.randomUUID()}` };
              // 保存用にデータURL化してlocalStorageへ永続化
              try {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () => reject(new Error('failed_to_read_image'));
                  reader.readAsDataURL(entryImageFile);
                });
                const key = 'chart_images';
                const existingRaw = localStorage.getItem(key);
                const existing: Record<string, string> = existingRaw ? JSON.parse(existingRaw) : {};
                existing[attachChart.imageId] = dataUrl;
                localStorage.setItem(key, JSON.stringify(existing));
              } catch (e) {
                console.warn('画像の保存に失敗しました（プレビュー用）', e);
              }
            }
          }
        } else {
          console.warn('統合分析APIエラー:', response.status);
        }
      } catch (error) {
        console.error('統合分析実行エラー:', error);
      } finally {
        setIsAnalyzing(false);
      }
    }

    // 右カラムのストアを更新
    const chatIdForEntry = currentChatId || undefined;
    console.log('🎯 Creating position with chatId:', chatIdForEntry);
    // 銘柄名を抽出（"4661 オリエンタルランド"形式の場合）
    let symbolName = '';
    if (entrySymbol.includes(' ')) {
      const parts = entrySymbol.split(' ');
      symbolName = parts.slice(1).join(' ');
    }
    
    const createdPosition = positionsEntry(
      symbolCodeForPosition,
      entryPositionType === 'long' ? 'LONG' : 'SHORT',
      price,
      qty,
      symbolName || undefined,
      chatIdForEntry
    );

    // AI成功時のみ画像IDを紐付け（初回エントリー限定）
    if (attachChart) {
      updatePosition(
        symbolCodeForPosition,
        entryPositionType === 'long' ? 'LONG' : 'SHORT',
        {
          chartImageId: attachChart.imageId,
          aiFeedbacked: true,
        },
        chatIdForEntry
      );
    }

    // ボットメッセージ：取引プラン
    const seedPrice = createdPosition?.avgPrice ?? price;
    const seedQty = createdPosition?.qtyTotal ?? qty;
    const planSeed = createPlanLegacyMessage(seedPrice, seedQty, entrySide, planConfig, {
      relatedEntryId: entryMessageId,
    });
    const planMessage: Message = {
      id: planSeed.id,
      type: 'bot',
      content: planSeed.content,
      timestamp: planSeed.timestamp,
      relatedEntryId: entryMessageId,
    };
    const planTimeoutId = window.setTimeout(() => {
      planMessageTimers.current.delete(entryMessageId);
      setMessages(prev => [
        ...prev,
        planMessage,
      ]);
    }, 500); // 少し遅延してボットメッセージを表示
    planMessageTimers.current.set(entryMessageId, { timeoutId: planTimeoutId, message: planMessage });

    setIsEntryModalOpen(false);
    setEntrySymbol('');
    setEntryPrice('');
    setEntryQuantity('');
    setEntryPositionType('long');
    setEntryChartPattern('');
    setShowChartPatternSelect(false);
    setEntryMemo('');
    setShowMemoTextarea(false);
    
    // モーダル用画像状態をクリア
    if (entryImagePreview) {
      revokePreviewURL(entryImagePreview);
    }
    setEntryImageFile(null);
    setEntryImagePreview('');
    setImageError('');
  };

  const handleExitSubmit = async () => {
    // Check if we're in edit mode
    if (editingMessageId) {
      await handleExitUpdate();
      return;
    }

    // 画像バリデーションエラーがある場合は送信を阫止
    if (imageError) {
      alert('画像アップロードにエラーがあります。修正してから送信してください。');
      return;
    }
    
    // カードからの呼び出し時のバリデーション
    if (!exitSymbol || !exitSide) {
      alert('約定はカードの「約定入力」から実行してください（銘柄・サイドが未選択）');
      return;
    }
    
    // チャットIDの検証
    if (exitChatId && exitChatId !== currentChatId) {
      alert('このポジションは他のチャットで建てられたため、決済できません');
      return;
    }

    const price = parseFloat(exitPrice);
    const qty = parseInt(exitQuantity, 10);
    
    // 銘柄名を取得
    const symbolDict = await loadSymbols();
    const symbolData = symbolDict.find(s => s.code === exitSymbol);
    const symbolName = symbolData?.name || '';
    
    // バリデーション
    if (isNaN(price) || isNaN(qty)) {
      alert("価格と数量を正しく入力してください");
      return;
    }
    
    if (price <= 0 || qty <= 0) {
      alert("価格と数量は正の数値で入力してください");
      return;
    }

    // 右カラムのストアに決済を通知
    let settleResult;
    try {
      console.log(`🔍 DEBUG: Attempting to settle position: symbol=${exitSymbol}, side=${exitSide}, price=${price}, qty=${qty}`);
      settleResult = positionsSettle(exitSymbol, exitSide, price, qty, exitChatId || currentChatId || undefined);
      console.log(`🔍 DEBUG: Settle result:`, settleResult);
    } catch (e: any) {
      alert(e?.message || '決済に失敗しました');
      return;
    }

    // 建値を取得（ポジションストアの平均建値を優先し、バックアップを用意）
    let entryVal = 0;

    // 1) Positions store の平均建値（カード表示と一致させる）
    try {
      const state = getPositionsState();
      const posKey = `${exitSymbol}:${exitSide}:${exitChatId || currentChatId || 'default'}`;
      const pos = state.positions.get(posKey);
      if (pos && typeof pos.avgPrice === 'number' && pos.avgPrice > 0) {
        entryVal = pos.avgPrice;
      }
    } catch {}

    // 2) 完全クローズ時は settleResult の tradeSnapshot から補完
    if (entryVal <= 0 && settleResult?.tradeSnapshot && typeof settleResult.tradeSnapshot.avgEntry === 'number') {
      entryVal = settleResult.tradeSnapshot.avgEntry;
    }

    // 3) それでも取得できない場合は、従来の保持値/メッセージ解析でフォールバック
    if (entryVal <= 0) {
      entryVal = currentEntryPrice;
    }
    
    // 保存された建値がない場合、メッセージから取得
    if (entryVal <= 0) {
      const lastEntry = messages.slice().reverse().find((m: Message) => m.type === 'user' && m.content.includes("建値入力しました"));
      if (lastEntry) {
        // "建値: 3,000円" の形式から数値を抽出（カンマを除去）
        const match = lastEntry.content.match(/建値:\s*([\d,]+)円/);
        if (match) {
          entryVal = parseFloat(match[1].replace(/,/g, ''));
        }
      }
    }
    
    // entryVal validation complete

    // 建値が見つからない場合のエラーハンドリング
    if (entryVal <= 0) {
      alert("建値が見つかりません。先に建値を入力してください。");
      return;
    }

    // 1. EXIT メッセージをチャットAPIに送信
    try {
      const apiUrl = getApiUrl();
      const memoValue = exitMemo.trim();
      const exitNote = memoValue.length > 0 ? memoValue : null;
      const exitMessage = {
        type: "EXIT",
        author_id: "user-1",
        payload: {
          tradeId: crypto.randomUUID(), // TODO: 実際のtradeIdを使用
          exitPrice: price,
          exitQty: qty,
          note: exitNote,
          executedAt: new Date().toISOString()
        }
      };

      const response = await fetch(`${apiUrl}/chats/default-chat-123/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exitMessage)
      });

      if (response.ok) {
        const newMessage = await response.json();
        // メッセージを画面に反映
        setMessages(prev => [
          ...prev,
          convertChatMessageToTradeMessage(newMessage)
        ]);
        try {
          positionsRecordSettlement(newMessage.id, {
            symbol: exitSymbol,
            side: exitSide,
            chatId: exitChatId || currentChatId || undefined,
            exitPrice: price,
            exitQty: qty,
            realizedPnl: settleResult?.realizedPnl || 0,
            matchedLots: (settleResult?.details?.matchedLots || []).map((l: any) => ({ lotPrice: l.lotPrice, qty: l.qty })),
          });
        } catch (e) {
          console.warn('Failed to record settlement history (success):', e);
        }
      } else {
        console.error('Failed to create EXIT message:', response.statusText);
        // フォールバックで既存のメッセージ形式を使用
        const localId = crypto.randomUUID();
        const fallbackMemoLine = exitMemo.trim().length > 0 ? `<br/>メモ: ${exitMemo.trim().replace(/\n/g, '<br/>')}` : '';
        setMessages(prev => [
          ...prev,
          {
            id: localId,
            type: 'user' as const,
            isTradeAction: true,
            content: `✅ 約定しました！<br/>銘柄: ${exitSymbol} ${symbolName}<br/>ポジションタイプ: ${exitSide === 'LONG' ? 'ロング（買い）' : 'ショート（売り）'}<br/>決済価格: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株${fallbackMemoLine}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
        // ローカルメッセージでも復元できるよう決済履歴を保存
        try {
          positionsRecordSettlement(localId, {
            symbol: exitSymbol,
            side: exitSide,
            chatId: exitChatId || currentChatId || undefined,
            exitPrice: price,
            exitQty: qty,
            realizedPnl: settleResult?.realizedPnl || 0,
            matchedLots: (settleResult?.details?.matchedLots || []).map((l: any) => ({ lotPrice: l.lotPrice, qty: l.qty })),
          });
        } catch (e) {
          console.warn('Failed to record settlement history (fallback):', e);
        }
      }
    } catch (error) {
      console.error('Error creating EXIT message:', error);
      // フォールバックで既存のメッセージ形式を使用
      const localId = crypto.randomUUID();
      const fallbackMemoLine = exitMemo.trim().length > 0 ? `<br/>メモ: ${exitMemo.trim().replace(/\n/g, '<br/>')}` : '';
      setMessages(prev => [
        ...prev,
        {
          id: localId,
          type: 'user' as const,
          isTradeAction: true,
          content: `✅ 約定しました！<br/>銘柄: ${exitSymbol} ${symbolName}<br/>ポジションタイプ: ${exitSide === 'LONG' ? 'ロング（買い）' : 'ショート（売り）'}<br/>決済価格: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株${fallbackMemoLine}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      // ローカルメッセージでも復元できるよう決済履歴を保存
      try {
        positionsRecordSettlement(localId, {
          symbol: exitSymbol,
          side: exitSide,
          chatId: exitChatId || currentChatId || undefined,
          exitPrice: price,
          exitQty: qty,
          realizedPnl: settleResult?.realizedPnl || 0,
          matchedLots: (settleResult?.details?.matchedLots || []).map((l: any) => ({ lotPrice: l.lotPrice, qty: l.qty })),
        });
      } catch (e) {
        console.warn('Failed to record settlement history (catch):', e);
      }
    }

    // 2. システム側メッセージを少し遅延して表示
    setTimeout(() => {
      // 損益計算
      const priceDiff = exitSide === 'LONG' ? (price - entryVal) : (entryVal - price);
      const pnl = priceDiff * qty;
      const priceDiffStr = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString()}円`;
      const pnlStr = `${pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}円`;

      // メッセージ生成
      let messageContent = '';
      
      if (pnl > 0) {
        // 利益時のメッセージ
        messageContent = `💹 損益情報<br/><br/>平均建値: ${entryVal.toLocaleString()}円<br/>約定価格: ${price.toLocaleString()}円<br/>差額: <span style="color: #16a34a;">${priceDiffStr}</span><br/>株数: ${qty.toLocaleString()}株<br/>損益額: <span style="color: #16a34a;">${pnlStr}</span><br/><br/>🎉 振り返り: おめでとうございます！利益を確定できました。今回の成功要因を分析して、次回の取引にも活かしましょう。`;
      } else if (pnl < 0) {
        // 損失時のメッセージ
        messageContent = `💹 損益情報<br/><br/>平均建値: ${entryVal.toLocaleString()}円<br/>約定価格: ${price.toLocaleString()}円<br/>差額: <span style="color: #dc2626;">${priceDiffStr}</span><br/>株数: ${qty.toLocaleString()}株<br/>損益額: <span style="color: #dc2626;">${pnlStr}</span><br/><br/>🤔 振り返り: 今回は残念ながら損失となりました。エントリーのタイミングや損切りラインを振り返り、次回に活かしましょう。`;
      } else {
        // ブレイクイーブン時のメッセージ
        messageContent = `💹 損益情報<br/><br/>平均建値: ${entryVal.toLocaleString()}円<br/>約定価格: ${price.toLocaleString()}円<br/>差額: ${priceDiffStr}<br/>株数: ${qty.toLocaleString()}株<br/>損益額: ${pnlStr}<br/><br/>😐 振り返り: ブレイクイーブンでした。リスクを最小限に抑えた取引ができました。`;
      }

      const botMessageId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        {
          id: botMessageId,
          type: 'bot' as const,
          content: messageContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      
      // Submit to journal if trade was completed (qtyTotal became 0)
      if (settleResult?.tradeSnapshot) {
        // Extract feedback from chat history for this trade
        const chatFeedback = extractChatFeedbackForTrade(messages, exitSymbol, symbolName);
        const feedback = {
          text: chatFeedback || messageContent.replace(/<[^>]*>/g, ''), // Use chat feedback or fallback to system message
          tone: (pnl > 0 ? 'praise' : 'advice') as 'praise' | 'advice',
          nextActions: pnl > 0 ? ['次回も同じ戦略で取り組む'] : ['損切りラインを見直す', 'エントリータイミングを改善する'],
          messageId: botMessageId
        };
        
        const tradeSnapshot: TradeSnapshot = {
          ...settleResult.tradeSnapshot,
          feedback
        };
        
        // Submit to journal API (async, won't block UI)
        submitJournalEntry(tradeSnapshot);
        
        // 決済フィードバック生成（画像がある場合のみ）
        if (exitImageFile) {
          generateExitFeedback(exitSymbol, entryVal, price, exitSide, qty, exitImageFile, currentChatId);
        }
      }
    }, 1000); // 1秒遅延でシステムメッセージを表示
    
    // 決済時は既存の画像解析は実行しない（決済フィードバックのみ表示）
    // if (exitImageFile) {
    //   analyzeAndPostImage(exitImageFile, 'EXIT', exitSymbol);
    // }

    // モーダルを閉じて入力をクリア
    setIsExitModalOpen(false);
    setExitPrice('');
    setExitQuantity('');
    setExitChatId('');
    setExitMemo('');
    setShowExitMemo(false);
    
    // モーダル用画像状態をクリア
    if (exitImagePreview) {
      revokePreviewURL(exitImagePreview);
    }
    setExitImageFile(null);
    setExitImagePreview('');
    setImageError('');
    
    // Mark related ENTRY messages as settled when position is fully closed
    const didClosePosition = (() => {
      if (!settleResult) {
        return false;
      }
      if (settleResult.position === null) {
        return true;
      }
      const qty = settleResult.position?.qtyTotal;
      return typeof qty === 'number' && qty <= 0;
    })();

    console.log(`🔍 DEBUG: Settlement check - settleResult exists: ${!!settleResult}, has tradeSnapshot: ${!!settleResult?.tradeSnapshot}, didClosePosition: ${didClosePosition}`);
    if (settleResult?.tradeSnapshot || didClosePosition) {
      console.log(`🔍 DEBUG: Position fully closed, marking ENTRY messages as settled for ${exitSymbol} ${exitSide}`);
      console.log(`🔍 DEBUG: Checking ${messages.length} messages for settlement marking`);
      // Find and mark ENTRY messages for this symbol and side as settled
      messages.forEach(message => {
        if (message.type === 'user' && message.content.includes('建値入力しました')) {
          const content = message.content;
          const symbolMatch = content.match(/銘柄:\s*([^\<\<br/\>]+)/);
          const symbol = symbolMatch ? symbolMatch[1].trim() : '';
          
          const positionMatch = content.match(/ポジションタイプ:\s*([^\<\<br/\>]+)/);
          const positionText = positionMatch ? positionMatch[1].trim() : '';
          const side = (positionText.includes('ロング') || positionText.includes('LONG')) ? 'LONG' : 'SHORT';
          
          // Enhanced symbol matching: handle both code-only (6702) and code+name (6702 富士通) formats
          const symbolMatches = symbol === exitSymbol || 
                               symbol.startsWith(exitSymbol + ' ') || 
                               exitSymbol.startsWith(symbol + ' ') ||
                               (symbol.includes(' ') && exitSymbol.includes(' ') && symbol.split(' ')[0] === exitSymbol.split(' ')[0]);
          
          const isMatch = symbolMatches && side === exitSide;
          
          console.log(`🔍 DEBUG: Checking ENTRY message ${message.id}: symbol="${symbol}", side=${side}, exitSymbol="${exitSymbol}", exitSide=${exitSide}, match=${isMatch}`);
          
          // Mark as settled if symbol and side match the settled position
          if (isMatch) {
            markEntryAsSettled(message.id);
          }
        }
      });
    } else {
      console.log(`🔍 DEBUG: No complete settlement detected, not marking entries as settled`);
    }
    
    // Force re-render to update edit icon visibility for settled ENTRY messages
    // The isEntrySettled function will now return true for messages related to the settled position
    setTimeout(() => {
      console.log(`🔍 DEBUG: Forcing re-render. Current settled entries:`, Array.from(settledEntries));
      refreshEntryActionState();
    }, 100);
  };

  // 特定のチャットにメッセージを追加する関数
  const addMessageToSpecificChat = (chatId: string | null, message: any) => {
    if (!chatId) {
      // チャットIDがない場合は現在のチャットに追加（従来通り）
      setMessages(prev => [...prev, message]);
      return;
    }
    
    // 現在アクティブなチャットの場合は即座に表示
    if (chatId === currentChatId) {
      setMessages(prev => [...prev, message]);
    }
    
    // 既存のチャットデータに直接メッセージを追加
    setChats(prevChats => {
      return prevChats.map(chat => {
        if (chat.id === chatId) {
          const updatedMessages = [...(chat.messages || []), message];
          return {
            ...chat,
            messages: updatedMessages
          };
        }
        return chat;
      });
    });
    
    console.log(`決済フィードバックをチャット ${chatId} に追加しました`);
  };

  // 決済フィードバック生成関数
  const generateExitFeedback = async (
    symbol: string, 
    entryPrice: number, 
    exitPrice: number, 
    positionSide: string, 
    quantity: number, 
    imageFile: File,
    targetChatId: string | null
  ) => {
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('symbol', symbol);
      formData.append('entry_price', entryPrice.toString());
      formData.append('exit_price', exitPrice.toString());
      formData.append('position_type', positionSide === 'LONG' ? 'long' : 'short');
      formData.append('quantity', quantity.toString());
      formData.append('exit_date', new Date().toISOString());

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/feedback/exit`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const feedbackData = await response.json();
        if (feedbackData.success && feedbackData.feedback_html) {
          // 決済フィードバック結果を決済したチャットに追加
          setTimeout(() => {
            const feedbackMessage = {
              id: crypto.randomUUID(),
              type: 'bot' as const,
              content: feedbackData.feedback_html,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            
            // 決済したチャットに確実にメッセージを追加
            addMessageToSpecificChat(targetChatId, feedbackMessage);
            
          }, 2000); // 既存メッセージの後に表示
        }
      } else {
        console.warn('決済フィードバックAPIエラー:', response.status);
      }
    } catch (error) {
      console.error('決済フィードバック生成エラー:', error);
    }
  };



  return (
      <div className="h-screen bg-white font-inter flex flex-col"
           style={{ height: 'calc(100vh - 64px)' }}>
      {/* Main container with sidebar and chat area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          isVisible={isFileListVisible}
          chats={chats}
          selectedChatId={currentChatId}
          onCreateNewChat={handleCreateNewChat}
          onSelectChat={handleSelectChat}
          onEditChatName={handleEditChatName}
          onDeleteChat={handleDeleteChat}
          isCreatingChat={isCreatingChat}
        />

        {/* Chat Area - Full width with scrollbar on right edge */}
        <div className="flex-1 flex flex-col relative">
          {/* Chat Messages Container - Full width scrollable */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto bg-white"
            style={{ paddingBottom: '200px' }}
          >
            <div className="px-20 py-6">
              <div className="max-w-4xl mx-auto">
                <div className="space-y-4 p-4">
                  {loading && (
                    <div className="flex justify-center my-2">
                      <div className="px-4 py-2 bg-yellow-100 text-yellow-800 text-sm rounded-lg shadow">
                        🤖 AIが回答を生成しています...
                      </div>
                    </div>
                  )}
                  {/* Messages Display */}
                  {messages.map((message) => {
                    const isEntryMessage = Boolean(
                      message.isTradeAction &&
                      typeof message.content === 'string' &&
                      message.content.includes('建値入力しました')
                    );

                    let entryActionProps: {
                      canEdit: boolean;
                      canDelete: boolean;
                      reason?: string | { edit?: string; delete?: string };
                    } | undefined;

                    if (isEntryMessage) {
                      const explicit = message.entryPermissions;
                      const settled = isEntrySettled(message);
                      const canEdit = explicit?.canEdit ?? !settled;
                      const canDelete = explicit?.canDelete ?? !settled;
                      const reason = explicit?.reasons ?? (settled
                        ? { edit: ENTRY_ACTION_DISABLED_REASON, delete: ENTRY_ACTION_DISABLED_REASON }
                        : undefined);

                      entryActionProps = {
                        canEdit,
                        canDelete,
                        reason,
                      };
                    }

                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        onImageClick={handleImageClick}
                        isHighlighted={highlightedMessageId === message.id}
                        onMessageEdit={ENABLE_CHAT_BUBBLE_EDIT ? handleMessageEdit : undefined}
                        isEntrySettled={isEntrySettled}
                        onMessageUndo={ENABLE_CHAT_BUBBLE_EDIT ? handleMessageUndo : undefined}
                        entryCanEdit={entryActionProps?.canEdit}
                        entryCanDelete={entryActionProps?.canDelete}
                        entryDisabledReason={entryActionProps?.reason}
                        onEntryDelete={ENABLE_CHAT_BUBBLE_EDIT ? handleEntryDeleteRequest : undefined}
                        isDeleting={deletingEntryIds.has(message.id)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Bottom Input Area - Only for chat area, doesn't invade sidebar */}
          <div 
            className="absolute bottom-0 left-0 right-0 z-10"
            style={{ 
              background: 'linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0) 100%)',
              paddingTop: '20px'
            }}
          >
            <div className="px-20 pb-6">
              <div className="max-w-4xl mx-auto">
                {/* Chat Input Card - with edit header when editing */}
                <div className="bg-[#F7F8FA] shadow-lg rounded-2xl mb-4">
                  {/* Edit header (only in edit mode) */}
                  {editingTextMessage && (
                    <div className="flex items-center justify-between bg-[#6B7280] text-white rounded-t-2xl px-4 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                        </svg>
                        <span>編集する</span>
                      </div>
                      <button
                        onClick={handleCancelTextEdit}
                        disabled={isUpdating}
                        aria-label="編集をキャンセル"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-60"
                      >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Upper tier: Preview list + Text input field */}
                  <div className="mb-4 px-6 py-4 relative">
                    {pendingImages.length > 0 && (
                      <div role="list" className="mb-3 flex flex-wrap gap-3">
                        {pendingImages.map(img => (
                          <div role="listitem" key={img.id} className="group relative flex items-center gap-2 p-2 bg-[#F3F4F6] rounded-xl">
                            <img src={img.url} alt={img.file.name} className="w-[72px] h-[72px] object-cover rounded-lg border" />
                            <div className="flex flex-col max-w-[160px]">
                              <span className="text-xs text-gray-600 truncate">{img.file.name}</span>
                              <span className="text-xs text-gray-400">{formatBytes(img.size)}</span>
                            </div>
                            <button type="button" onClick={() => removePreview(img.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="AIに質問する..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        // 編集時は ⌘/Ctrl+Enter で更新、通常時は Enter 送信
                        if (editingTextMessage && (e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSendMessage();
                          return;
                        }
                        if (editingTextMessage && e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelTextEdit();
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey && !editingTextMessage) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className={`w-full h-12 bg-white border border-[#E5E7EB] rounded-lg outline-none text-[#333] placeholder-[#999] text-base px-4`}
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  {/* Lower tier: Buttons and controls */}
                  <div className="flex items-center px-6 pb-4">
                    {/* Left side buttons */}
                    <div className="flex gap-3 mr-6">
                      {/* Entry Button */}
                      <button
                        onClick={() => {
                          console.log('🆕 建値入力ボタンがクリックされました - 新規入力モード');
                          // 新規建値入力では編集状態をクリア
                          setEditingMessageId(null);
                          // モーダルを開く
                          setIsEntryModalOpen(true);
                        }}
                        className="bg-[#007AFF] hover:bg-[#0056CC] text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors w-[120px]"
                      >
                        建値入力
                      </button>
                      {/* Exit Button (rendered but hidden/disabled per spec) */}
                      <button
                        data-testid="payment-button"
                        onClick={() => setIsExitModalOpen(true)}
                        disabled
                        aria-hidden="true"
                        aria-disabled="true"
                        tabIndex={-1}
                        className="hidden bg-[#FF3B30] hover:bg-[#D70015] text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors disabled:cursor-not-allowed"
                      >
                        決済
                      </button>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1"></div>

                    {/* File upload area */
                    }
                    <div className="border-2 border-dashed border-[#D1D5DB] bg-white rounded-xl px-5 py-3 flex items-center gap-2 mr-4 text-[#6B7280]">
                      <label className="cursor-pointer flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm whitespace-nowrap">チャート画像をアップロード</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          multiple
                          onChange={handleFileSelect}
                        />
                      </label>
                    </div>

                    {/* Send button stays at default position even in edit mode */}
                    <button
                      onClick={handleSendMessage}
                      disabled={(chatInput.trim().length === 0 && pendingImages.length === 0) || (editingTextMessage && isUpdating) || isSending}
                      className="bg-[#007AFF] hover:bg-[#0056CC] disabled:bg-[#C7C7CC] text-white w-12 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                      aria-label={editingTextMessage ? '更新を送信' : '送信'}
                    >
                      {isSending ? (
                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column for positions */}
        <div className="w-[360px] shrink-0 border-l border-[#E5E7EB] bg-[#E9F7F6]">
          <RightPanePositions 
            chatId={currentChatId} 
            onAddBotMessage={(message) => {
              setMessages(prev => [...prev, {
                id: message.id,
                type: message.type,
                content: message.content,
                timestamp: message.timestamp,
                'data-testid': message.testId
              }]);
              setTimeout(() => scrollToLatestMessage(), 50);
            }}
          />
        </div>
      </div>

      {/* Entry Modal */}
      <ModalBase
        isOpen={isEntryModalOpen}
        onClose={() => {
          if (entryImagePreview) {
            revokePreviewURL(entryImagePreview);
          }
          setEntryImageFile(null);
          setEntryImagePreview('');
          setImageError('');
          setIsEntryModalOpen(false);
          clearEditMode();
          // モーダルクローズ時にフォームもクリア
          setEntrySymbol('');
          setEntryCode('');
          setEntryPrice('');
          setEntryQuantity('');
          setEntryPositionType('long');
          setAutoFilled(false);
        }}
        title={editingMessageId ? '建値を編集' : '建値入力'}
      >
        <div className="mt-4 space-y-4">
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">銘柄</Label>
            <AutocompleteSymbol
              value={entrySymbol}
              onChange={(v)=>{ 
                setEntrySymbol(v);
                setAutoFilled(false);
                // 手動入力時は自動モードを無効化
                if (symbolInputMode === 'auto' && v !== symbolInput) {
                  setSymbolInputMode('manual');
                }
              }}
              onSelect={(item:any)=>{ 
                // 選択時は完全な値を設定
                const newValue = `${item.code} ${item.name}`;
                setEntrySymbol(newValue);
                setEntryCode(item.code);
                setAutoFilled(false);
                setSymbolInputMode('manual');
              }}
              placeholder="銘柄コードまたは名称"
              autoBadge={(() => {
                const isEditing = !!editingMessageId;
                const shouldShowBadge = !isEditing && (autoFilled || (symbolInputMode === 'auto' && autoSymbolBadge));
                return shouldShowBadge;
              })()}
            />
          </div>
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">ポジションタイプ</Label>
            <Select value={entryPositionType} onValueChange={setEntryPositionType}>
              <SelectTrigger className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent className="z-[10000] bg-white border border-gray-200 shadow-lg">
                <SelectItem value="long">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#16A34A]" />
                    <span>ロング（買い）</span>
                  </div>
                </SelectItem>
                <SelectItem value="short">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-[#DC2626]" />
                    <span>ショート（売り）</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">価格</Label>
            <Input
              placeholder="円"
              value={entryPrice}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryPrice(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB] bg-[#F6F6F6]"
            />
          </div>
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">数量</Label>
            <Input
              placeholder="株"
              value={entryQuantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryQuantity(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB] bg-[#F6F6F6]"
            />
          </div>
          
          {/* AI分析（任意） */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <div className="mb-3">
              <Label className="text-sm text-[#374151] font-medium">AI分析（任意）</Label>
            </div>
            
            <div className="space-y-3" data-testid="entry-ai-upload">
              <ChartImageUploader
                value={entryImageFile}
                onChange={handleEntryImageChange}
                onError={handleEntryImageError}
                showPreview={false}
              />

              {/* プレビュー表示 */}
              {entryImagePreview && (
                <div className="relative inline-block">
                  <img
                    src={entryImagePreview}
                    alt="アップロード予定画像"
                    className="max-w-[200px] max-h-[150px] rounded border border-[#E5E7EB] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (entryImagePreview) {
                        revokePreviewURL(entryImagePreview);
                      }
                      setEntryImageFile(null);
                      setEntryImagePreview('');
                      setImageError('');
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                    aria-label="画像を削除"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {/* エラーメッセージはアップローダー内で表示 */}
            </div>
          </div>
          <div className="w-full space-y-2">
            {showChartPatternSelect ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-[#374151] font-medium">チャートパターン</Label>
                    <span className="text-xs text-gray-400">任意</span>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-gray-500 ml-2 cursor-pointer"
                    data-testid="close-chartpattern"
                    onClick={() => setShowChartPatternSelect(false)}
                  >
                    閉じる
                  </button>
                </div>
                <Select
                  value={entryChartPattern || undefined}
                  onValueChange={(value) => setEntryChartPattern(value as ChartPattern)}
                >
                  <SelectTrigger
                    className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]"
                    data-testid="chartpattern-select"
                    name="chartPattern"
                  >
                    <SelectValue placeholder="パターンを選択" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000] bg-white border border-gray-200 shadow-lg">
                    {CHART_PATTERNS.map((pattern) => (
                      <SelectItem key={pattern.value} value={pattern.value}>
                        {pattern.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-700"
                  data-testid="add-chartpattern"
                  onClick={() => setShowChartPatternSelect(true)}
                >
                  ＋ チャートパターンを追加
                </button>
                {entryChartPattern && (
                  <span className="text-xs text-gray-500">
                    選択中: {CHART_PATTERN_LABEL_MAP[entryChartPattern]}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="w-full space-y-2">
            {showMemoTextarea ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-[#374151] font-medium">メモ</Label>
                    <span className="text-xs text-gray-400">任意</span>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-gray-500 ml-2 cursor-pointer"
                    data-testid="close-memo"
                    onClick={() => setShowMemoTextarea(false)}
                  >
                    閉じる
                  </button>
                </div>
                <textarea
                  className="w-full rounded-lg border border-[#D1D5DB] focus:border-[#2563EB] p-3 resize-y min-h-[96px]"
                  placeholder="エントリー理由や感情を入力"
                  value={entryMemo}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setEntryMemo(event.target.value)}
                  name="memo"
                  maxLength={500}
                  data-testid="memo-textarea"
                />
                <div className="text-xs text-[#6B7280] text-right">最大500文字</div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-700"
                  data-testid="add-memo"
                  onClick={() => setShowMemoTextarea(true)}
                >
                  ＋ メモを追加
                </button>
                {entryMemo.trim().length > 0 && (
                  <span className="text-xs text-gray-500">
                    下書きあり
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end items-center mt-6">
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsEntryModalOpen(false)}
                className="text-[#6B7280] hover:text-[#374151]"
              >
                キャンセル
              </Button>
              <PrimaryButton 
                onClick={handleEntrySubmit} 
                variant="primary"
                disabled={isEntrySubmitDisabled}
                className={isEntrySubmitDisabled ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isAnalyzing ? '🔄 分析中...' : '送信'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </ModalBase>

      {/* Delete Entry Modal */}
      <EntryDeleteDialog
        open={entryDeleteState.isOpen}
        preview={entryDeletePreview}
        isDeleting={isDeletingEntry}
        onCancel={() => {
          if (isDeletingEntry) return;
          setEntryDeleteState({ isOpen: false });
        }}
        onConfirm={handleConfirmEntryDelete}
      />

      {/* Exit Modal */}
      <ModalBase
        isOpen={isExitModalOpen}
        onClose={() => {
        if (exitImagePreview) {
            revokePreviewURL(exitImagePreview);
          }
          setExitImageFile(null);
          setExitImagePreview('');
          setImageError('');
          setExitMemo('');
          setShowExitMemo(false);
          setIsExitModalOpen(false);
          clearEditMode();
        }}
        title="約定入力"
      >
        <div className="mt-4 space-y-4">
          <div className="text-xs text-zinc-500">
            {(() => {
              const symbolInfo = findByCode(exitSymbol);
              const displaySymbol = symbolInfo ? `${exitSymbol} ${symbolInfo.name}` : exitSymbol;
              return `${displaySymbol} / ${exitSide || '未選択'}`;
            })()} {exitChatId && exitChatId !== currentChatId ? '⚠️ 他チャット' : ''}
          </div>
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">価格</Label>
            <Input
              placeholder="円"
              value={exitPrice}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExitPrice(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB] bg-[#F6F6F6]"
            />
          </div>
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">数量</Label>
            <Input
              placeholder="株"
              value={exitQuantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExitQuantity(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB] bg-[#F6F6F6]"
            />
          </div>
          
          {/* チャート画像アップロード（任意） */}
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">
              チャート画像アップロード（任意）
            </Label>
            <div className="space-y-3">
              {/* チャットUIと同じデザイン */}
              <label className="w-full h-12 border-2 border-dashed border-[#D1D5DB] rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:border-[#9CA3AF] transition-colors">
                <Upload className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-sm text-[#9CA3AF]">
                  {exitImageFile ? exitImageFile.name : 'ファイルを選択'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const validation = validateImage(file);
                    if (!validation.ok) {
                      setImageError(validation.message || '');
                      return;
                    }
                    
                    setImageError('');
                    setExitImageFile(file);
                    
                    // 既存のプレビューURLをクリーンアップ
                    if (exitImagePreview) {
                      revokePreviewURL(exitImagePreview);
                    }
                    
                    const previewUrl = makePreviewURL(file);
                    setExitImagePreview(previewUrl);
                  }}
                />
              </label>
              
              {/* プレビュー表示 */}
              {exitImagePreview && (
                <div className="relative inline-block">
                  <img
                    src={exitImagePreview}
                    alt="アップロード予定画像"
                    className="max-w-[200px] max-h-[150px] rounded border border-[#E5E7EB] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (exitImagePreview) {
                        revokePreviewURL(exitImagePreview);
                      }
                      setExitImageFile(null);
                      setExitImagePreview('');
                      setImageError('');
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                    aria-label="画像を削除"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {/* エラーメッセージ */}
              {imageError && (
                <div className="text-red-600 text-xs" role="alert">
                  {imageError}
                </div>
              )}
              
              {/* ヘルプテキスト */}
              <div className="text-xs text-[#6B7280]">
                対応形式：png / jpeg・最大10MB
              </div>
            </div>
          </div>
          <div className="w-full space-y-3">
            {showExitMemo ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-[#374151] font-medium">メモ</Label>
                    <span className="text-xs text-gray-400">任意</span>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-gray-500 ml-2 cursor-pointer"
                    data-testid="settle-close-memo"
                    onClick={() => setShowExitMemo(false)}
                  >
                    閉じる
                  </button>
                </div>
                <textarea
                  ref={exitMemoRef}
                  className="w-full rounded-lg border border-[#D1D5DB] focus:border-[#2563EB] p-3 resize-y min-h-[96px]"
                  placeholder="エントリー/クローズ理由や感情を入力"
                  value={exitMemo}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setExitMemo(event.target.value)}
                  name="memo"
                  maxLength={1000}
                  data-testid="settle-memo-textarea"
                />
                <div className="text-xs text-gray-400 mt-1 text-right">最大1000文字</div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-700"
                  data-testid="settle-add-memo"
                  onClick={() => setShowExitMemo(true)}
                >
                  ＋ メモを追加
                </button>
                {exitMemo.trim().length > 0 && (
                  <span className="text-xs text-gray-500">下書きあり</span>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsExitModalOpen(false)}
              className="text-[#6B7280] hover:text-[#374151]"
            >
              キャンセル
            </Button>
            <PrimaryButton 
              onClick={handleExitSubmit} 
              variant="danger"
              className={imageError ? 'opacity-50 cursor-not-allowed' : ''}
            >
              送信
            </PrimaryButton>
          </div>
        </div>
      </ModalBase>

      {/* 画像拡大モーダル */}
      <ImageModal
        isOpen={imageModalOpen}
        onClose={closeImageModal}
        imageUrl={selectedImageUrl}
        altText="拡大画像"
      />
      </div>
  );
}

export default Trade;
