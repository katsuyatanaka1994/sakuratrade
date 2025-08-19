import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Send,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { marked } from "marked";
import { useSearchParams } from 'react-router-dom';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './UI/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './UI/select';
import Sidebar from './Sidebar';
import ImageModal from './ImageModal';
import RightPanePositions from './positions/RightPanePositions';
import AutocompleteSymbol from './AutocompleteSymbol';
import { getLatestSymbolFromChat, loadSymbols } from '../utils/symbols';
import type { ChatMsg } from '../utils/symbols';
import { useSymbolSuggest } from '../hooks/useSymbolSuggest';
import { useToast } from './ToastContainer';
import { entry as positionsEntry, settle as positionsSettle, submitJournalEntry, TradeSnapshot } from '../store/positions';

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

// Message interface for chat
interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
}

// Chat interface for chat management
interface Chat {
  id: string;
  name: string;
  messages: Message[];
  updatedAt: string;
}

// MessageBubble Component with improved style & timestamp below bubble
const MessageBubble: React.FC<{ 
  message: Message; 
  onImageClick?: (imageUrl: string) => void;
  isHighlighted?: boolean;
}> = ({ message, onImageClick, isHighlighted }) => {
  const isUser = message.type === 'user';
  const messageRef = React.useRef<HTMLDivElement>(null);
  
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

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      <div
        ref={messageRef}
        data-message-id={message.id}
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow transition-all duration-300 ${
          isHighlighted 
            ? 'ring-2 ring-yellow-400 bg-yellow-50' 
            : isUser
              ? 'bg-blue-100 text-[#1E3A8A] ml-auto'
              : 'bg-white border border-[#E5E7EB] text-[#111827] mr-auto'
        } ${isUser ? 'ml-auto' : 'mr-auto'}`}
      >
        <span dangerouslySetInnerHTML={{ __html: message.content }} />
      </div>
      <span className="mt-1 text-[10px] text-gray-400 px-1">{message.timestamp}</span>
    </div>
  );
};

// Primary Button Variant
const PrimaryButton: React.FC<{ 
  children: React.ReactNode; 
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'danger';
}> = ({ children, onClick, className = '', variant = 'primary' }) => {
  const baseClass = "h-12 px-6 rounded-lg text-white font-medium transition-colors";
  const variantClass = variant === 'primary' 
    ? 'bg-[#3B82F6] hover:bg-[#2563EB]' 
    : 'bg-[#EF4444] hover:bg-[#DC2626]';
    
  return (
    <Button 
      onClick={onClick}
      className={`${baseClass} ${variantClass} ${className}`}
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
  <Dialog
    open={isOpen}
    onOpenChange={onClose}
    aria-labelledby="dialog-title"
    aria-describedby="dialog-description"
  >
    <DialogContent
      id="dialog-description"
      className="w-[400px] rounded-[24px] p-6 bg-white shadow-[0_8px_24px_0_rgba(0,0,0,0.1)] z-[9999] relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 fixed"
    >
      <DialogHeader>
        <DialogTitle id="dialog-title" className="text-base font-semibold text-[#374151]">
          {title}
        </DialogTitle>
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
  
  // 銘柄自動入力関連の状態
  const [symbolInputMode, setSymbolInputMode] = useState<'auto' | 'manual'>('auto');
  const [autoSymbolBadge, setAutoSymbolBadge] = useState(false);
  const [symbolInput, setSymbolInput] = useState('');

  // チャットデータの状態管理
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false); // チャット作成中フラグ

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
      console.log('🔍 銘柄自動検出開始:', { currentChatId, messageCount: messages.length });
      
      // 銘柄辞書をロード
      const symbolDict = await loadSymbols();
      if (symbolDict.length === 0) {
        console.log('❌ 銘柄辞書が空です');
        return;
      }
      
      // 現在のチャットのメッセージをChatMsg形式に変換（HTMLタグを除去）
      const chatMessages: ChatMsg[] = messages.map((msg, index) => ({
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
      const newChat: Chat = {
        id: fallbackId,
        name: defaultName,
        messages: [],
        updatedAt: new Date().toISOString()
      };
      
      setChats(prevChats => [newChat, ...prevChats]);
      setCurrentChatId(fallbackId);
      setSelectedFile(defaultName);
      setMessages([]);
      
      localStorage.setItem("lastSelectedFile", defaultName);
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
  const [chatInput, setChatInput] = useState('');
  const [entrySymbol, setEntrySymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryPositionType, setEntryPositionType] = useState('long');
  const [exitSymbol, setExitSymbol] = useState<string>('');
  const [exitSide, setExitSide] = useState<'LONG'|'SHORT'|''>('');
  const [exitPrice, setExitPrice] = useState('');
  const [exitQuantity, setExitQuantity] = useState('');
  const [exitChatId, setExitChatId] = useState<string>('');
  
  // 画像拡大モーダルの状態
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  
  // モーダル内画像アップロード関連の状態
  const [entryImageFile, setEntryImageFile] = useState<File | null>(null);
  const [entryImagePreview, setEntryImagePreview] = useState<string>('');
  const [exitImageFile, setExitImageFile] = useState<File | null>(null);
  const [exitImagePreview, setExitImagePreview] = useState<string>('');
  const [imageError, setImageError] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  

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
  React.useEffect(() => {
    (window as any).handleImageClick = handleImageClick;
    return () => {
      delete (window as any).handleImageClick;
    };
  }, []);

  // モーダル状態の変更を監視
  React.useEffect(() => {
    console.log('🖼️ Modal状態が変更されました:', { imageModalOpen, selectedImageUrl });
  }, [imageModalOpen, selectedImageUrl]);
  
  // 現在の建値を記録する状態（決済時に参照用）
  const [currentEntryPrice, setCurrentEntryPrice] = useState<number>(0);
  
  // 画像バリデーション関数
  const validateImage = (file: File): { ok: boolean; message?: string } => {
    if (!file.type.startsWith('image/')) {
      return { ok: false, message: '画像ファイルのみアップロードできます' };
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

  // Modal open -> auto-fill latest symbol from chat context
  useEffect(() => {
    if (!isEntryModalOpen) return;
    
    // まずフィールドをクリア
    setEntrySymbol('');
    setEntryCode('');
    setAutoFilled(false);
    console.log('🔍 建値入力モーダルが開かれました - 自動入力を開始');
    (async () => {
      try {
        console.log('📊 現在のチャット状況:', {
          currentChatId,
          messageCount: messages.length,
          messages: messages.map(m => ({ 
            id: m.id, 
            type: m.type,
            content: m.content,
            timestamp: m.timestamp
          }))
        });

        // メッセージがない場合は早期リターン
        if (messages.length === 0) {
          console.log('💬 チャットにメッセージがありません。銘柄を含むメッセージを送信してから建値入力を試してください。');
          setAutoFilled(false);
          return;
        }

        const dict = await fetch('/data/symbols.json').then(r => r.json()).catch(() => []);
        console.log('📚 銘柄辞書を読み込み:', dict.length, '件');
        console.log('📚 辞書サンプル:', dict.slice(0, 3));

        const msgs: ChatMsg[] = messages.map((m, idx) => ({
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
  }, [isEntryModalOpen]);

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
  
  // Scroll to bottom to show latest message
  const scrollToLatestMessage = () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  useEffect(() => {
    // メッセージが追加されたら最新メッセージを表示（DOM更新後に実行）
    setTimeout(() => {
      scrollToLatestMessage();
    }, 100);
  }, [messages]);
  const [loading, setLoading] = useState(false);
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
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    
    // 新しいメッセージを追加
    const newUserMessage = {
      id: crypto.randomUUID(),
      type: 'user' as const,
      content: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setTimeout(() => scrollToLatestMessage(), 50);
    setChatInput('');
    
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
    }
  };

  const handleEntrySubmit = () => {
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

    // Retrieve user's configured TP/SL percentages from localStorage (default values if not set)
    const tpPercent = parseFloat(localStorage.getItem('takeProfitPercent') || '5'); // e.g., 5%
    const slPercent = parseFloat(localStorage.getItem('stopLossPercent') || '2'); // e.g., 2%

    // ポジションタイプの表示用文字列
    const positionText = entryPositionType === 'long' ? 'ロング（買い）' : 'ショート（売り）';

    // 現在の建値を保存（決済時に使用）
    setCurrentEntryPrice(price);

    // ユーザーメッセージ：建値入力完了
    setMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'user' as const,
        content: `📈 建値入力しました！<br/>銘柄: ${entrySymbol}<br/>ポジションタイプ: ${positionText}<br/>建値: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    
    // 画像が添付されている場合のみ、非同期で解析し結果を投稿
    if (entryImageFile) {
      analyzeAndPostImage(entryImageFile, 'ENTRY', entrySymbol);
    }

    // 右カラムのストアを更新
    const chatIdForEntry = currentChatId || undefined;
    console.log('🎯 Creating position with chatId:', chatIdForEntry);
    positionsEntry(entryCode || entrySymbol, entryPositionType === 'long' ? 'LONG' : 'SHORT', price, qty, undefined, chatIdForEntry);

    // 利確・損切り目標価格計算とボットメッセージ
    const takeProfit = entryPositionType === 'long' 
      ? price * (1 + tpPercent / 100)
      : price * (1 - tpPercent / 100);
    const stopLoss = entryPositionType === 'long'
      ? price * (1 - slPercent / 100)
      : price * (1 + slPercent / 100);

    // 予想損益計算
    const expectedProfitAmount = Math.abs(takeProfit - price) * qty;
    const expectedLossAmount = Math.abs(price - stopLoss) * qty;

    // ボットメッセージ：取引プラン
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'bot' as const,
          content: `🎯 取引プラン設定<br/>📋 リスク管理ルール<br/>• 利確目標: +${tpPercent}% → <span style="color: #16a34a;">${takeProfit.toLocaleString()}円</span><br/>• 損切り目標: -${slPercent}% → <span style="color: #dc2626;">${stopLoss.toLocaleString()}円</span><br/><br/>💰 予想損益<br/>• 利確時: <span style="color: #16a34a;">+${expectedProfitAmount.toLocaleString()}円</span><br/>• 損切り時: <span style="color: #dc2626;">-${expectedLossAmount.toLocaleString()}円</span><br/><br/>⚠️ 重要: 必ず逆指値注文を設定して、感情に左右されない取引を心がけましょう`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }, 500); // 少し遅延してボットメッセージを表示

    setIsEntryModalOpen(false);
    setEntrySymbol('');
    setEntryPrice('');
    setEntryQuantity('');
    setEntryPositionType('long');
    
    // モーダル用画像状態をクリア
    if (entryImagePreview) {
      revokePreviewURL(entryImagePreview);
    }
    setEntryImageFile(null);
    setEntryImagePreview('');
    setImageError('');
  };

  const handleExitSubmit = async () => {
    // 画像バリデーションエラーがある場合は送信を阫止
    if (imageError) {
      alert('画像アップロードにエラーがあります。修正してから送信してください。');
      return;
    }
    
    // カードからの呼び出し時のバリデーション
    if (!exitSymbol || !exitSide) {
      alert('決済はカードの「決済入力」から実行してください（銘柄・サイドが未選択）');
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
      settleResult = positionsSettle(exitSymbol, exitSide, price, qty, exitChatId || currentChatId || undefined);
    } catch (e: any) {
      alert(e?.message || '決済に失敗しました');
      return;
    }

    // 建値を取得（保存された状態を優先、バックアップとしてメッセージから取得）
    let entryVal = currentEntryPrice;
    
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
    
    // デバッグ用ログ
    console.log('Debug - entryVal:', entryVal, 'currentEntryPrice:', currentEntryPrice);

    // 建値が見つからない場合のエラーハンドリング
    if (entryVal <= 0) {
      alert("建値が見つかりません。先に建値を入力してください。");
      return;
    }

    // 1. ユーザー側メッセージを即座に表示
    setMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'user' as const,
        content: `✅ 決済しました！<br/>銘柄: ${exitSymbol} ${symbolName}<br/>ポジションタイプ: ${exitSide === 'LONG' ? 'ロング（買い）' : 'ショート（売り）'}<br/>決済価格: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);

    // 2. システム側メッセージを少し遅延して表示
    setTimeout(() => {
      // 損益計算
      const priceDiff = price - entryVal;
      const pnl = priceDiff * qty;
      const priceDiffStr = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString()}円`;
      const pnlStr = `${pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}円`;

      // メッセージ生成
      let messageContent = '';
      
      if (pnl > 0) {
        // 利益時のメッセージ
        messageContent = `💹 損益情報<br/><br/>建値価格: ${entryVal.toLocaleString()}円<br/>決済価格: ${price.toLocaleString()}円<br/>差額: <span style="color: #16a34a;">${priceDiffStr}</span><br/>株数: ${qty.toLocaleString()}株<br/>損益額: <span style="color: #16a34a;">${pnlStr}</span><br/><br/>🎉 振り返り: おめでとうございます！利益を確定できました。今回の成功要因を分析して、次回の取引にも活かしていきましょう。`;
      } else if (pnl < 0) {
        // 損失時のメッセージ
        messageContent = `💹 損益情報<br/><br/>建値価格: ${entryVal.toLocaleString()}円<br/>決済価格: ${price.toLocaleString()}円<br/>差額: <span style="color: #dc2626;">${priceDiffStr}</span><br/>株数: ${qty.toLocaleString()}株<br/>損益額: <span style="color: #dc2626;">${pnlStr}</span><br/><br/>🤔 振り返り: 今回は残念ながら損失となりました。エントリーのタイミングや損切りラインを振り返り、次回に活かしましょう。`;
      } else {
        // ブレイクイーブン時のメッセージ
        messageContent = `💹 損益情報<br/><br/>建値価格: ${entryVal.toLocaleString()}円<br/>決済価格: ${price.toLocaleString()}円<br/>差額: ${priceDiffStr}<br/>株数: ${qty.toLocaleString()}株<br/>損益額: ${pnlStr}<br/><br/>😐 振り返り: ブレイクイーブンでした。リスクを最小限に抑えた取引ができました。`;
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
      console.log('🔍 Journal check:', { settleResult, hasTradeSnapshot: !!settleResult?.tradeSnapshot });
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
        console.log('📋 Submitting to journal:', tradeSnapshot);
        submitJournalEntry(tradeSnapshot).then(success => {
          console.log('📋 Journal submission result:', success);
        }).catch(error => {
          console.error('📋 Journal submission error:', error);
        });
      }
    }, 1000); // 1秒遅延でシステムメッセージを表示
    
    // 画像が添付されている場合のみ、非同期で解析し結果を投稿
    if (exitImageFile) {
      analyzeAndPostImage(exitImageFile, 'EXIT', exitSymbol);
    }

    // モーダルを閉じて入力をクリア
    setIsExitModalOpen(false);
    setExitPrice('');
    setExitQuantity('');
    setExitChatId('');
    
    // モーダル用画像状態をクリア
    if (exitImagePreview) {
      revokePreviewURL(exitImagePreview);
    }
    setExitImageFile(null);
    setExitImagePreview('');
    setImageError('');
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
                  {messages.map((message, index) => (
                    <MessageBubble 
                      key={`${message.id}-${index}`} 
                      message={message} 
                      onImageClick={handleImageClick}
                      isHighlighted={message.id === highlightedMessageId}
                    />
                  ))}
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
                <div className="bg-[#F8F9FB] shadow-md rounded-lg">
                  <div className="flex items-center justify-center gap-6 px-6 py-3">
                    {/* Entry Button */}
                    <PrimaryButton
                      onClick={() => setIsEntryModalOpen(true)}
                      className="w-28"
                      variant="primary"
                    >
                      建値入力
                    </PrimaryButton>
                    {/* Exit Button */}
                    <PrimaryButton
                      onClick={() => setIsExitModalOpen(true)}
                      className="w-28"
                      variant="danger"
                    >
                      決済入力
                    </PrimaryButton>
                    {/* File Upload */}
                    <label className="w-56 h-12 border-2 border-dashed border-[#D1D5DB] rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:border-[#9CA3AF] transition-colors">
                      <Upload className="w-5 h-5 text-[#9CA3AF]" />
                      <span className="text-sm text-[#9CA3AF]">チャート画像をアップロード</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                  <div className="flex items-center px-6 py-3 gap-4">
                    <Input
                      placeholder="AI に質問する…"
                      value={chatInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
                      disabled={loading}
                      className="flex-1 h-10 rounded-lg border-[#D1D5DB] focus:border-[#2563EB] disabled:opacity-50"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={loading || !chatInput.trim()}
                      className="w-10 h-10 bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column for positions */}
        <div className="w-[360px] shrink-0 border-l border-[#E5E7EB] bg-[#E9F7F6]">
          <RightPanePositions chatId={currentChatId} />
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
        }}
        title="建値入力"
      >
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-[#374151]">銘柄</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSymbolInputMode('auto');
                    updateSymbolFromChat();
                  }}
                  className={`text-xs px-2 py-1 rounded ${symbolInputMode === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  自動
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSymbolInputMode('manual');
                    setAutoSymbolBadge(false);
                  }}
                  className={`text-xs px-2 py-1 rounded ${symbolInputMode === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  手動
                </button>
              </div>
            </div>
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
                setEntrySymbol(`${item.code} ${item.name}`);
                setEntryCode(item.code);
                setAutoFilled(false);
                // 選択時は手動モードに切り替え
                setSymbolInputMode('manual');
              }}
              placeholder="銘柄コードまたは名称"
              autoBadge={autoFilled || (symbolInputMode === 'auto' && autoSymbolBadge)}
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
                  {entryImageFile ? entryImageFile.name : 'ファイルを選択'}
                </span>
                <input
                  type="file"
                  accept="image/*"
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
                    setEntryImageFile(file);
                    
                    // 既存のプレビューURLをクリーンアップ
                    if (entryImagePreview) {
                      revokePreviewURL(entryImagePreview);
                    }
                    
                    const previewUrl = makePreviewURL(file);
                    setEntryImagePreview(previewUrl);
                  }}
                />
              </label>
              
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
              
              {/* エラーメッセージ */}
              {imageError && (
                <div className="text-red-600 text-xs" role="alert">
                  {imageError}
                </div>
              )}
              
              {/* ヘルプテキスト */}
              <div className="text-xs text-[#6B7280]">
                画像ファイルのみ、最大10MBまで。アップロードするとAIが解析し結果を投稿します。
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
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
              className={imageError ? 'opacity-50 cursor-not-allowed' : ''}
            >
              送信
            </PrimaryButton>
          </div>
        </div>
      </ModalBase>

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
          setIsExitModalOpen(false);
        }}
        title="決済入力"
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
                  accept="image/*"
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
                画像ファイルのみ、最大10MBまで。アップロードするとAIが解析し結果を投稿します。
              </div>
            </div>
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
