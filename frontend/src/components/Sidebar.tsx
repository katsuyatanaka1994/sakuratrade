import React, { useState } from 'react';

interface Chat {
  id: string;
  name: string;
  messages?: any[];
  updatedAt?: string;
}

interface SidebarProps {
  isVisible: boolean;
  chats: Chat[];
  selectedChatId: string | null;
  onCreateNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onEditChatName: (chatId: string, newName: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isVisible,
  chats,
  selectedChatId,
  onCreateNewChat,
  onSelectChat,
  onEditChatName,
}) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    chatId: string;
    chatName: string;
  } | null>(null);

  if (!isVisible) return null;

  const handleStartEditing = (chatId: string, currentName: string) => {
    setEditingChatId(chatId);
    setEditingName(currentName);
    setContextMenu(null); // コンテキストメニューを閉じる
  };

  const handleSaveEdit = () => {
    if (editingChatId && editingName.trim()) {
      onEditChatName(editingChatId, editingName.trim());
    }
    setEditingChatId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditingName('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, chatId: string, chatName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      chatId,
      chatName
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleRenameClick = () => {
    if (contextMenu) {
      handleStartEditing(contextMenu.chatId, contextMenu.chatName);
    }
  };

  // 外部クリックでコンテキストメニューを閉じる
  React.useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    
    if (contextMenu?.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu?.visible]);

  return (
    <aside className="bg-[#F8F9FA] border-r border-[#E5E7EB] flex flex-col w-44 flex-shrink-0">
      {/* 新規チャットボタン */}
      <div className="p-3">
        <button
          onClick={onCreateNewChat}
          className="w-full flex items-center justify-between px-2 py-2 text-sm font-bold text-gray-700 bg-[#F1F2F5] rounded hover:bg-[#E8E9ED] transition-colors duration-200"
        >
          <span>新規チャット</span>
          <img
            src="/assets/note_stack_add_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg"
            alt="新規チャット"
            className="w-5 h-5 flex-shrink-0"
          />
        </button>
      </div>

      {/* 区切り線 */}
      <div className="border-t border-[#E5E7EB] mx-3"></div>

      {/* チャット一覧見出し */}
      <div className="px-3 py-2 mt-2">
        <h3 className="text-xs font-medium text-[#888888] uppercase tracking-wider">
          チャット一覧
        </h3>
      </div>

      {/* チャット項目リスト */}
      <div className="flex-1 overflow-y-auto px-2">
        {chats.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            チャットがありません
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`
                px-3 py-2 mx-1 my-1 rounded text-sm cursor-pointer transition-colors duration-200
                ${
                  selectedChatId === chat.id
                    ? 'bg-[#E3F2FD] text-[#1976D2] border-l-2 border-[#1976D2]'
                    : 'text-gray-700 hover:bg-gray-100'
                }
              `}
              onClick={() => onSelectChat(chat.id)}
              onContextMenu={(e) => handleContextMenu(e, chat.id, chat.name)}
            >
              {editingChatId === chat.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onBlur={handleSaveEdit}
                  className="w-full bg-transparent border-none outline-none text-sm"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="truncate">
                  {chat.name}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* コンテキストメニュー */}
      {contextMenu?.visible && (
        <div
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
            onClick={handleRenameClick}
          >
            名前を変更する
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;