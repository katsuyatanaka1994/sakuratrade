import React from 'react';
import { Edit3, Undo2 } from 'lucide-react';
import type { ChatMessage, LegacyMessage } from '../types/chat';

interface MessageItemProps {
  message: ChatMessage | LegacyMessage;
  currentUserId?: string;
  onEdit?: (message: ChatMessage | LegacyMessage) => void;
  onUndo?: (message: ChatMessage | LegacyMessage) => void;
  onImageClick?: (imageUrl: string) => void;
  isHighlighted?: boolean;
  canUndo?: boolean;
  isSaving?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  currentUserId,
  onEdit,
  onUndo,
  onImageClick,
  isHighlighted,
  canUndo = false,
  isSaving = false
}) => {
  const messageRef = React.useRef<HTMLDivElement>(null);
  
  // Legacy message compatibility
  const isLegacyMessage = 'type' in message && (message.type === 'user' || message.type === 'bot');
  const chatMessage = isLegacyMessage ? null : (message as ChatMessage);
  const isUser = isLegacyMessage
    ? (message as LegacyMessage).type === 'user'
    : chatMessage?.authorId === currentUserId;
  
  // Check if message is editable (only user's own messages)
  const isEditable = isLegacyMessage
    ? (message as LegacyMessage).type === 'user'
    : chatMessage?.authorId === currentUserId;

  // Consider a message edited only when updatedAt exists and changed from createdAt
  const isEdited = Boolean(
    chatMessage?.updatedAt && chatMessage.updatedAt !== chatMessage.createdAt
  );

  const getMessageContent = () => {
    if (isLegacyMessage) {
      return (message as LegacyMessage).content;
    }

    const nonLegacyMessage = message as ChatMessage;
    switch (nonLegacyMessage.type) {
      case 'TEXT':
        return nonLegacyMessage.text;
      case 'ENTRY':
        const { symbolCode, symbolName, side, price, qty, note } = nonLegacyMessage.payload;
        const entryHeadline = isEdited
          ? '📈 建値を入力しました！（編集済み）'
          : '📈 建値を入力しました！';
        return `${entryHeadline}<br/>銘柄: ${symbolCode} ${symbolName}<br/>ポジションタイプ: ${side === 'LONG' ? 'ロング（買い）' : 'ショート（売り）'}<br/>建値: ${price.toLocaleString()}円<br/>数量: ${qty}株${note ? `<br/>📝 ${note}` : ''}`;
      case 'EXIT':
        const { tradeId, exitPrice, exitQty, note: exitNote } = nonLegacyMessage.payload;
        return `✅ 決済しました！<br/>銘柄: ${tradeId}<br/>ポジションタイプ: ロング（買い）<br/>決済価格: ${exitPrice.toLocaleString()}円<br/>数量: ${exitQty}株${exitNote ? `<br/>📝 ${exitNote}` : ''}`;
      default:
        return '';
    }
  };

  const getTimestamp = () => {
    if (isLegacyMessage) {
      return (message as LegacyMessage).timestamp;
    }
    
    if (!chatMessage) {
      return '';
    }

    return new Date(chatMessage.createdAt).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
  };

  const getUpdatedTimestamp = () => {
    if (!isEdited || !chatMessage?.updatedAt) {
      return '';
    }

    return new Date(chatMessage.updatedAt).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
  };

  // Handle image clicks for legacy messages
  React.useEffect(() => {
    if (messageRef.current && onImageClick && isLegacyMessage) {
      const images = messageRef.current.querySelectorAll('img[data-image-url]');
      const overlays = messageRef.current.querySelectorAll('.image-overlay');
      
      const handleClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        
        let imageUrl = null;
        const target = event.target as HTMLElement;
        
        if (target.tagName === 'IMG') {
          imageUrl = (target as HTMLImageElement).getAttribute('data-image-url');
        } else {
          const parentGroup = target.closest('.relative.group');
          if (parentGroup) {
            const img = parentGroup.querySelector('img[data-image-url]') as HTMLImageElement;
            if (img) {
              imageUrl = img.getAttribute('data-image-url');
            }
          }
        }
        
        if (imageUrl) {
          onImageClick(imageUrl);
        }
      };

      images.forEach((img) => {
        img.addEventListener('click', handleClick);
      });
      
      overlays.forEach((overlay) => {
        overlay.addEventListener('click', handleClick);
      });

      return () => {
        images.forEach((img) => {
          img.removeEventListener('click', handleClick);
        });
        overlays.forEach((overlay) => {
          overlay.removeEventListener('click', handleClick);
        });
      };
    }
  }, [onImageClick, isLegacyMessage]);

  const handleEdit = () => {
    if (onEdit && isEditable) {
      onEdit(message);
    }
  };

  const handleUndo = () => {
    if (onUndo && isEditable && canUndo) {
      onUndo(message);
    }
  };

  const handleEditKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && isEditable) {
      event.preventDefault();
      handleEdit();
    }
  };

  const handleUndoKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && isEditable && canUndo) {
      event.preventDefault();
      handleUndo();
    }
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4 group`}>
      <div className="relative">
        {isSaving && (
          <div className="absolute inset-0 z-10 rounded-2xl bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <span className="text-xs text-gray-500" aria-live="polite">保存中…</span>
          </div>
        )}
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
          <span dangerouslySetInnerHTML={{ __html: getMessageContent() }} />
        </div>
        
        {/* Action Icons - Only show for user's own messages */}
        {isEditable && (onEdit || (onUndo && canUndo)) && (
          <div className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-200">
            {/* Edit Icon */}
            {onEdit && (
              <button
                onClick={handleEdit}
                onKeyDown={handleEditKeyDown}
                aria-label="メッセージを編集"
                className={`
                  p-1 rounded-full bg-white shadow-sm border border-gray-200
                  text-gray-400 hover:text-gray-600 hover:bg-gray-50
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                `}
              >
                <Edit3 size={14} />
              </button>
            )}
            
            {/* Undo Icon - Only for EXIT messages within time limit */}
            {onUndo && canUndo && (
              <button
                onClick={handleUndo}
                onKeyDown={handleUndoKeyDown}
                aria-label="決済を取り消し"
                className={`
                  p-1 rounded-full bg-white shadow-sm border border-gray-200
                  text-gray-400 hover:text-gray-600 hover:bg-gray-50
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
                `}
              >
                <Undo2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
        <span className="text-[10px] text-gray-400">
          {getTimestamp()}
        </span>
        {isEdited && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            (編集済) 最終更新 {getUpdatedTimestamp()}
          </span>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
