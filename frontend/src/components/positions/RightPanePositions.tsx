import React, { useEffect, useState, useRef } from 'react';
import { getGroups, subscribe } from '../../store/positions';
import type { Position } from '../../store/positions';
import { formatLSHeader } from '../../lib/validation';
import { useSymbolSuggest } from '../../hooks/useSymbolSuggest';
import PositionContextMenu from '../PositionContextMenu';
import EditEntryModal from '../EditEntryModal';
import { EntryPayload } from '../../types/chat';

const Badge: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
    <span className="opacity-70">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const PositionCard: React.FC<{ p: Position; chatId?: string | null; findByCode: (code: string) => any }> = ({ p, chatId, findByCode }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  
  // Current user context (simplified for demo - in real app this would come from auth)
  const currentUserId = 'current_user';
  
  // Permission check: Only show edit icon for OPEN positions owned by current user
  const canEdit = p.status === 'OPEN' && p.ownerId === currentUserId;

  const handleSettleClick = () => {
    window.dispatchEvent(new CustomEvent('open-settle-from-card', { detail: { symbol: p.symbol, side: p.side, maxQty: p.qtyTotal, chatId: chatId } }));
  };
  
  const handleEditClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const rect = editButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenuPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8
      });
      setShowContextMenu(true);
    }
  };
  
  const handleLongPressStart = (event: React.TouchEvent) => {
    event.preventDefault();
    longPressTimerRef.current = setTimeout(() => {
      const touch = event.touches[0];
      setContextMenuPosition({
        x: touch.clientX,
        y: touch.clientY
      });
      setShowContextMenu(true);
    }, 500); // 500ms long press
  };
  
  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleEditClick(event as any);
    }
  };
  
  const handleEditModalOpen = () => {
    setShowEditModal(true);
  };
  
  const handleEditModalSave = async (data: EntryPayload) => {
    setEditModalLoading(true);
    try {
      // In a real app, this would send data to backend to update the position
      console.log('Saving position edit:', data);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setEditModalLoading(false);
    }
  };
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);
  
  // 色とボーダーをサイドに応じて設定
  const borderColor = p.side === 'LONG' ? 'border-emerald-200' : 'border-red-200';
  const labelBgColor = p.side === 'LONG' ? 'bg-emerald-100' : 'bg-red-100';
  const labelTextColor = p.side === 'LONG' ? 'text-emerald-600' : 'text-red-600';
  
  return (
    <>
      <div className={`rounded-xl border-2 ${borderColor} bg-white p-4 relative`} style={{boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.09)'}}>
        <div className="flex items-center justify-between mb-4">
          <div className={`px-4 py-1 rounded-full text-sm font-medium ${labelBgColor} ${labelTextColor} min-w-[80px] text-center`}>
            {p.side}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">
              更新 {new Date(p.updatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {canEdit && (
              <button
                ref={editButtonRef}
                onClick={handleEditClick}
                onTouchStart={handleLongPressStart}
                onTouchEnd={handleLongPressEnd}
                onKeyDown={handleKeyDown}
                className="size-5 rounded-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center justify-center transition-colors"
                aria-label="ポジションを編集"
                title="編集メニューを開く"
              >
                <svg className="size-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      
      <div className="flex gap-3 mb-4">
        <div className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300 whitespace-nowrap">
          保有 {p.qtyTotal}株
        </div>
        <div className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300 whitespace-nowrap">
          平均建値 ¥{new Intl.NumberFormat('ja-JP').format(p.avgPrice)}
        </div>
      </div>
      
      <div className="mt-5">
        <button 
          onClick={handleSettleClick} 
          className="w-full bg-red-600 text-white text-base font-medium py-2 rounded-full hover:bg-red-700 transition-colors"
        >
          決済入力
        </button>
      </div>
      </div>
      
      {/* Context Menu */}
      <PositionContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        onEdit={handleEditModalOpen}
        position={contextMenuPosition}
      />
      
      {/* Edit Modal */}
      <EditEntryModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={{
          symbolCode: p.symbol,
          symbolName: p.name || '',
          side: p.side,
          price: p.avgPrice,
          qty: p.qtyTotal,
          note: '',
          executedAt: new Date().toISOString().slice(0, 16),
          tradeId: p.currentTradeId || ''
        }}
        onSave={handleEditModalSave}
        isLoading={editModalLoading}
      />
    </>
  );
};

interface RightPanePositionsProps {
  chatId?: string | null;
}

const RightPanePositions: React.FC<RightPanePositionsProps> = ({ chatId }) => {
  // 銘柄情報取得のためのhook
  const { findByCode } = useSymbolSuggest();
  
  // chatIdがnullまたはundefinedの場合は空のポジションを表示
  const [groups, setGroups] = useState(() => {
    return chatId ? getGroups(chatId) : [];
  });

  useEffect(() => {
    // chatIdが変更されたらポジションを更新
    const result = chatId ? getGroups(chatId) : [];
    setGroups(result);
    
    const unsub = subscribe(() => {
      const updated = chatId ? getGroups(chatId) : [];
      setGroups(updated);
    });
    return () => unsub();
  }, [chatId]);

  // chatIdがnullの場合はポジションを表示しない
  if (!chatId || groups.length === 0) {
    const message = !chatId ? 
      'チャットを選択してください' : 
      'ポジションはまだありません';
    
    return (
      <div className="h-full p-4">
        <h2 className="text-[16px] font-semibold text-[#1F2937] mb-4">オープンポジション</h2>
        <div className="text-xs text-[#6B7280]">{message}</div>
        {!chatId && (
          <div className="text-xs text-[#DC2626] mt-2">⚠️ チャットID: {String(chatId)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full p-4 space-y-4">
      <h2 className="text-[16px] font-semibold text-[#1F2937]">オープンポジション</h2>
      {groups.map((g) => {
        const long = g.positions.find(p => p.side === 'LONG')?.qtyTotal ?? 0;
        const short = g.positions.find(p => p.side === 'SHORT')?.qtyTotal ?? 0;
        const header = formatLSHeader(long, short);
        // グループ表示用の銘柄情報を取得
        const groupSymbolInfo = findByCode(g.symbol);
        const groupDisplayName = groupSymbolInfo ? `${g.symbol} ${groupSymbolInfo.name}` : g.symbol;
        
        return (
          <div key={g.symbol} className="rounded-xl bg-white shadow-sm p-4">
            {/* 上部の銘柄情報 */}
            <div className="space-y-4">
              <div className="text-sm text-gray-600 font-medium">
                {header}
              </div>
              <div className="text-xl font-bold text-gray-900">
                {g.symbol} {groupSymbolInfo?.name || ''}
              </div>
            </div>
            
            {/* ポジション部分 */}
            <div className="space-y-4 mt-2">
              {g.positions.filter(p => p.side === 'SHORT').map(p => <PositionCard key={`${p.symbol}:SHORT:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} />)}
              {g.positions.filter(p => p.side === 'LONG').map(p => <PositionCard key={`${p.symbol}:LONG:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RightPanePositions;