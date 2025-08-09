import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Send,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { marked } from "marked";
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/UI/select';
import Sidebar from './Sidebar';
import ImageModal from './ImageModal';
import RightPanePositions from './positions/RightPanePositions';
import AutocompleteSymbol from '@/components/AutocompleteSymbol';
import { getLatestSymbolFromChat, ChatMsg } from '@/utils/symbols';
import { entry as positionsEntry } from '../store/positions';
import { settle as positionsSettle } from '../store/positions';

// Helper function to get API URL - hardcoded for now to debug
const getApiUrl = () => {
  console.log('🔧 getApiUrl called');
  return "http://localhost:8000";
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
}> = ({ message, onImageClick }) => {
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
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow ${
          isUser
            ? 'bg-blue-100 text-[#1E3A8A] ml-auto'
            : 'bg-white border border-[#E5E7EB] text-[#111827] mr-auto'
        }`}
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
  // Restore last selected file on mount
  useEffect(() => {
    const lastFile = localStorage.getItem("lastSelectedFile");
    if (lastFile) {
      setSelectedFile(lastFile);
    }
  }, []);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [entryCode, setEntryCode] = useState('');

  // チャットデータの状態管理
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // 銘柄名を抽出する関数
  const extractStockName = (message: string): string | null => {
    // 日本の一般的な銘柄名パターン（優先順位順）
    const stockPatterns = [
      /\b(\d{4})\b/g, // 証券コード（4桁数字）
      /([ァ-ヶー]{2,10})/g, // カタカナ企業名（2-10文字）
      /([一-龯]{2,6}(?:銀行|電力|製作所|自動車|グループ|工業|商事|物産|建設|不動産|証券|保険|鉄道|航空|化学|製薬|食品|小売|通信))/g, // 漢字+業界名
      /([A-Z][a-zA-Z]{2,15})/g, // アルファベット企業名
      /(トヨタ|ソニー|パナソニック|任天堂|ソフトバンク|NTT|KDDI|三菱|三井|住友|みずほ|りそな|野村|大和|日本郵政|楽天|ファーストリテイリング|ユニクロ|セブンイレブン|イオン|武田薬品|花王|資生堂|キヤノン|富士通|日立|東芝|マツダ|ホンダ|日産|スズキ|ダイハツ)/g // 有名企業名
    ];
    
    for (const pattern of stockPatterns) {
      const matches = message.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }
    return null;
  };

  // 新規チャット作成ハンドラー
  const handleCreateNewChat = useCallback(() => {
    const newChatId = `chat_${Date.now()}`;
    const defaultName = `新規チャット ${chats.length + 1}`;
    
    const newChat: Chat = {
      id: newChatId,
      name: defaultName,
      messages: [],
      updatedAt: new Date().toISOString()
    };
    
    setChats(prevChats => [newChat, ...prevChats]);
    setCurrentChatId(newChatId);
    setSelectedFile(defaultName);
    setMessages([]);
    
    // localStorageに保存
    localStorage.setItem("lastSelectedFile", defaultName);
    localStorage.setItem("currentChatId", newChatId);
    
    console.log('✨ New chat created with ID:', newChatId);
  }, [chats.length]);

  // チャット選択ハンドラー
  const handleSelectChat = (chatId: string) => {
    const selectedChat = chats.find(chat => chat.id === chatId);
    if (selectedChat) {
      setCurrentChatId(chatId);
      setSelectedFile(selectedChat.name);
      setMessages(selectedChat.messages || []);
      
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

  // Chat messages state (initially empty)
  const [messages, setMessages] = useState<Message[]>([]);

  // Modal open -> auto-fill latest symbol from chat context
  useEffect(() => {
    if (!isEntryModalOpen) return;
    (async () => {
      try {
        const dict = await fetch('/data/symbols.json').then(r => r.json()).catch(() => []);
        const msgs: ChatMsg[] = messages.map((m, idx) => ({
          id: m.id,
          chatId: currentChatId || 'default',
          text: m.content.replace(/<[^>]*>/g, ''), // strip simple HTML tags
          createdAt: idx,
        }));
        const code = getLatestSymbolFromChat(msgs, dict);
        if (code) {
          const it = (dict as any[]).find((d: any) => d.code === code);
          if (it) {
            setEntrySymbol(`${it.code} ${it.name}`);
            setEntryCode(it.code);
            setAutoFilled(true);
          }
        } else {
          setAutoFilled(false);
        }
      } catch (_) {
        // ignore
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
      handleCreateNewChat();
    }
  }, []);

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
      
      // 2. 少し遅延してからAI回答を表示
      setTimeout(async () => {
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
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) throw new Error(`質問送信に失敗しました (HTTP ${res.status})`);
      const data = await res.json();

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
  };

  const handleExitSubmit = () => {
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
    try {
      positionsSettle(exitSymbol, exitSide, price, qty, exitChatId || currentChatId || undefined);
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
        content: `✅ 決済しました！<br/>決済価格: ${price.toLocaleString()}円<br/>数量: ${qty.toLocaleString()}株`,
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

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'bot' as const,
          content: messageContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }, 1000); // 1秒遅延でシステムメッセージを表示

    // モーダルを閉じて入力をクリア
    setIsExitModalOpen(false);
    setExitPrice('');
    setExitQuantity('');
    setExitChatId('');
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
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
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
        onClose={() => setIsEntryModalOpen(false)}
        title="建値入力"
      >
        <div className="mt-4 space-y-4">
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">銘柄</Label>
            <AutocompleteSymbol
              value={entrySymbol}
              onChange={(v)=>{ setEntrySymbol(v); setAutoFilled(false);} }
              onSelect={(item:any)=>{ setEntrySymbol(`${item.code} ${item.name}`); setEntryCode(item.code); setAutoFilled(false);} }
              placeholder="銘柄コードまたは名称"
              autoBadge={autoFilled}
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
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsEntryModalOpen(false)}
              className="text-[#6B7280] hover:text-[#374151]"
            >
              キャンセル
            </Button>
            <PrimaryButton onClick={handleEntrySubmit} variant="primary">
              送信
            </PrimaryButton>
          </div>
        </div>
      </ModalBase>

      {/* Exit Modal */}
      <ModalBase
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        title="決済入力"
      >
        <div className="mt-4 space-y-4">
          <div className="text-xs text-zinc-500">{exitSymbol} / {exitSide || '未選択'} {exitChatId && exitChatId !== currentChatId ? '⚠️ 他チャット' : ''}</div>
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
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsExitModalOpen(false)}
              className="text-[#6B7280] hover:text-[#374151]"
            >
              キャンセル
            </Button>
            <PrimaryButton onClick={handleExitSubmit} variant="danger">
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
