import React, { useState } from 'react';
import { useEffect } from 'react';
import { getAdviceMock } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  LayoutDashboard, 
  StickyNote, 
  Upload, 
  Send,
  X,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// Message interface for chat
interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
}

// MessageBubble Component with Variants
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.type === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-[70%] px-3 py-2 rounded-[20px] text-[12px] ${
          isUser 
            ? 'bg-[#EFF6FF] text-[#374151] ml-auto' 
            : 'bg-[#F3F4F6] text-[#374151] mr-auto'
        }`}
      >
        {message.content}
      </div>
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
    className={`w-full h-10 px-3 text-left text-sm border-b border-[#E5E7EB] transition-colors ${
      isActive 
        ? 'bg-[#F1F5F9] text-[#374151]' 
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
    <DialogContent className="w-[400px] rounded-[24px] p-6 shadow-[0_8px_24px_0_rgba(0,0,0,0.1)]">
      <DialogHeader>
        <DialogTitle className="text-base font-semibold text-[#374151]">
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

export default function Trade({ isFileListVisible, selectedFile, setSelectedFile }: TradeProps) {
  const navigate = useNavigate();
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryPositionType, setEntryPositionType] = useState('long');
  const [exitPrice, setExitPrice] = useState('');
  const [exitQuantity, setExitQuantity] = useState('');

  // Chat messages state (initially empty)
  const [messages, setMessages] = useState<Message[]>([]);

  const [advice, setAdvice] = useState<any>(null);

  useEffect(() => {
    async function fetchAdvice() {
      const result = await getAdviceMock();
      setAdvice(result);
    }
    fetchAdvice();
  }, []);
  // ファイルアップロード処理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/advice', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('アップロードに失敗しました');
      const data = await res.json();
      // data.content などと仮定
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}`,
          type: 'bot',
          content: data.content ?? 'アップロード結果を取得しました。',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}`,
          type: 'bot',
          content: 'アップロード中にエラーが発生しました。',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      // Here you would typically add the message to the chat
      console.log('Sending message:', chatInput);
      setChatInput('');
    }
  };

  const handleEntrySubmit = () => {
    console.log('Entry:', { 
      price: entryPrice, 
      quantity: entryQuantity, 
      positionType: entryPositionType 
    });
    setIsEntryModalOpen(false);
    setEntryPrice('');
    setEntryQuantity('');
    setEntryPositionType('long');
  };

  const handleExitSubmit = () => {
    console.log('Exit:', { price: exitPrice, quantity: exitQuantity });
    setIsExitModalOpen(false);
    setExitPrice('');
    setExitQuantity('');
  };



  return (
    <div className="h-screen bg-white font-inter flex flex-col pt-16">


      <div className="flex-1 flex">
        {/* Left Sidebar - 96px */}
        <aside className={`bg-[#F8F9FA] border-r border-[#E5E7EB] flex flex-col transition-all duration-300 ${
          isFileListVisible ? 'w-24' : 'w-0'
        }`}>
          {/* File List */}
          {isFileListVisible && (
            <div className="flex-1 pt-4">
              <FileItem 
                name="フジクラ" 
                isActive={selectedFile === 'フジクラ'}
                onClick={() => setSelectedFile('フジクラ')}
              />
              <FileItem 
                name="良品計画" 
                isActive={selectedFile === '良品計画'}
                onClick={() => setSelectedFile('良品計画')}
              />
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Main Pane */}
          <div className="flex-1 flex px-20 py-6">
            {/* Chat Area - Full Width */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 bg-white border border-[#E5E7EB] rounded-2xl mb-6">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                {advice && (
                  <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB]">
                    <h3 className="font-semibold">{advice.pattern_name}（スコア: {advice.score}）</h3>
                    <div dangerouslySetInnerHTML={{ __html: advice.advice_html }} />
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar - 64px */}
          <div className="h-16 bg-white border-t border-[#E5E7EB] flex items-center justify-center px-20">
            <div className="flex items-center gap-6">
              {/* File Upload Tile */}
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
              
              {/* Entry Button */}
              <PrimaryButton
                onClick={() => setIsEntryModalOpen(true)}
                className="w-45"
                variant="primary"
              >
                建値入力
              </PrimaryButton>
              
              {/* Exit Button */}
              <PrimaryButton
                onClick={() => setIsExitModalOpen(true)}
                className="w-45"
                variant="danger"
              >
                決済入力
              </PrimaryButton>
            </div>
          </div>

          {/* Question Footer - 56px */}
          <div className="h-14 bg-white border-t border-[#E5E7EB] flex items-center px-20 gap-4">
            <Input
              placeholder="AI に質問する…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 h-10 rounded-lg border-[#D1D5DB] focus:border-[#2563EB]"
            />
            <Button
              onClick={handleSendMessage}
              className="w-10 h-10 bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg p-0"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </Button>
          </div>
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
            <Label className="text-sm text-[#374151] mb-2 block">ポジションタイプ</Label>
            <Select value={entryPositionType} onValueChange={setEntryPositionType}>
              <SelectTrigger className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
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
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]"
            />
          </div>
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">数量</Label>
            <Input
              placeholder="株"
              value={entryQuantity}
              onChange={(e) => setEntryQuantity(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]"
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
              確認
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
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">価格</Label>
            <Input
              placeholder="円"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]"
            />
          </div>
          <div>
            <Label className="text-sm text-[#374151] mb-2 block">数量</Label>
            <Input
              placeholder="株"
              value={exitQuantity}
              onChange={(e) => setExitQuantity(e.target.value)}
              className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]"
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
              確認
            </PrimaryButton>
          </div>
        </div>
      </ModalBase>
    </div>
  );
}