import React, { useEffect, useState, useRef } from 'react';
import { getGroups, subscribe, updatePosition, deletePosition as storeDeletePosition } from '../../store/positions';
import type { Position } from '../../store/positions';
import { formatLSHeader } from '../../lib/validation';
import { useSymbolSuggest } from '../../hooks/useSymbolSuggest';
import PositionContextMenu from '../PositionContextMenu';
import EditEntryModal from '../EditEntryModal';
import { EntryPayload } from '../../types/chat';
import { 
  calculatePositionMetrics, 
  calculateUpdateDiff, 
  formatPrice, 
  formatQty, 
  formatPercent,
  type PositionMetrics,
  type PositionUpdateDiff 
} from '../../utils/positionCalculations';
import { sendPositionUpdateMessages } from '../../lib/botMessaging';
import { regeneratePositionAnalysis } from '../../lib/aiRegeneration';
import { executeRetry, showRetryToast, type RetryContext } from '../../lib/retryLogic';
import { classifyError } from '../../lib/errorHandling';
import { ToastContainer, showToast } from '../UI/Toast';
import { telemetryHelpers } from '../../lib/telemetry';

// Feature flag: レガシーAI再生成（/api/chat/... 経由）を一時無効化
const ENABLE_LEGACY_AI_REGENERATION = false;

const Badge: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
    <span className="opacity-70">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const PositionCard: React.FC<{ 
  p: Position; 
  chatId?: string | null; 
  findByCode: (code: string) => any;
  onPositionUpdate?: (position: Position) => void;
  onAddBotMessage?: (message: { id: string; type: 'bot'; content: string; timestamp: string; testId?: string }) => void;
}> = ({ p, chatId, findByCode, onPositionUpdate, onAddBotMessage }) => {
  // 取引プラン設定（Botのロジックに合わせる）
  const riskSettings = {
    stopLossPercent: 0.02,      // -2%
    profitTargetPercent: 0.05,  // +5%
  } as const;
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [positionMetrics, setPositionMetrics] = useState<PositionMetrics>(() => 
    calculatePositionMetrics(p, undefined, riskSettings)
  );
  const [isUpdating, setIsUpdating] = useState(false);
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
    
    // TODO: テレメトリ記録: メニュー表示 (API未実装のため一時無効化)
    // const positionCount = 1; // この位置では1つのポジション
    // telemetryHelpers.trackMenuOpened(p, 'button', positionCount);
    
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
      // TODO: テレメトリ記録: メニュー表示（ロングプレス） (API未実装のため一時無効化)
      // const positionCount = 1;
      // telemetryHelpers.trackMenuOpened(p, 'context', positionCount);
      
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
    // TODO: テレメトリ記録: モーダル表示 (API未実装のため一時無効化)
    // telemetryHelpers.trackEditOpened(p, 'menu', false);
    setShowEditModal(true);
  };
  
  const handleEditModalSave = async (data: EntryPayload) => {
    setEditModalLoading(true);
    try {
      // Placeholder for actual implementation
      // This will be handled by EditEntryModal's new success flow
      console.log('Position edit will be handled by modal:', data);
    } finally {
      setEditModalLoading(false);
    }
  };

  const handlePositionDelete = async () => {
    try {
      console.log('[PositionCard] handlePositionDelete start', { symbol: p.symbol, side: p.side, cardChatId: p.chatId, viewChatId: chatId });
      const ok = storeDeletePosition(p.symbol, p.side, p.chatId || chatId);
      console.log('[PositionCard] storeDeletePosition result', ok);
      if (ok) {
        showToast.success('ポジションを削除しました');
        // ボットメッセージ: 削除記録
        if (onAddBotMessage) {
          const info = findByCode(p.symbol);
          const symbolName = info?.name ? ` ${info.name}` : '';
          const sideText = p.side === 'LONG' ? 'ロング（買い）' : 'ショート（売り）';
          const content = `🗑️ ポジションを削除しました。<br/><br/>銘柄: ${p.symbol}${symbolName}<br/>ポジションタイプ: ${sideText}<br/>建値: ${Math.round(p.avgPrice).toLocaleString()}円<br/>数量: ${p.qtyTotal.toLocaleString()}株`;
          onAddBotMessage({
            id: crypto.randomUUID(),
            type: 'bot',
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            testId: 'bot-delete-position'
          });
        }
        // 親へ通知（即時リスト再取得のトリガ）
        if (onPositionUpdate) {
          onPositionUpdate({ ...p, status: 'DELETED' } as Position);
        }
        // 明示的な再描画イベントを発火（購読に加えて）
        if (typeof window !== 'undefined') {
          console.log('[PositionCard] dispatch positions-changed');
          window.dispatchEvent(new Event('positions-changed'));
        }
      } else {
        showToast.error('ポジションの削除に失敗しました');
      }
    } catch (error) {
      console.error('Position delete failed:', error);
      showToast.error('ポジションの削除に失敗しました');
    }
  };

  // Position更新成功後の処理
  const handlePositionUpdateSuccess = async (updatedPosition: Position) => {
    setIsUpdating(true);
    const oldPosition = { ...p }; // スナップショット作成
    
    try {
      // 1. Position Store更新（即時UI反映）
      const storeUpdatedPosition = updatePosition(
        p.symbol, 
        p.side, 
        {
          avgPrice: updatedPosition.avgPrice,
          qtyTotal: updatedPosition.qtyTotal,
          name: updatedPosition.name,
          updatedAt: updatedPosition.updatedAt || new Date().toISOString(),
          version: updatedPosition.version,
          // 画像保持（EditEntryModal側で追加された場合）
          chartImageId: updatedPosition.chartImageId ?? p.chartImageId,
          aiFeedbacked: updatedPosition.aiFeedbacked ?? p.aiFeedbacked
        },
        p.chatId
      );

      if (!storeUpdatedPosition) {
        throw new Error('Position store update failed');
      }

      // 2. Position Card再計算・更新
      const newMetrics = calculatePositionMetrics(storeUpdatedPosition, undefined, riskSettings);
      setPositionMetrics(newMetrics);
      
      // 3. 親コンポーネントに更新通知
      if (onPositionUpdate) {
        onPositionUpdate(storeUpdatedPosition);
      }
      
      // シーケンスログ記録（AC検証用）
      if ((window as any).acTestContext) {
        (window as any).acTestContext.sequenceLog.push({
          action: 'position_card_update',
          timestamp: Date.now(),
          success: true
        });
      }
      
      // 2. Bot投稿2件送信 (非同期・順序保証)
      if (chatId) {
        const updateDiff = calculateUpdateDiff(oldPosition, updatedPosition);
        const botResult = await sendPositionUpdateMessages(
          chatId,
          updatedPosition,
          updateDiff,
          {
            stopLossTarget: newMetrics.stopLossTarget,
            profitTarget: newMetrics.profitTarget,
            riskRatio: newMetrics.riskRatio
          }
        );
        
        // Bot投稿失敗時のトースト表示
        if (!botResult.allSuccess) {
          const errorDetail = classifyError(
            new Error(botResult.userMessageResult.success ? 
              'システムメッセージの送信に失敗しました' : 
              'ユーザーメッセージの送信に失敗しました'
            ),
            {
              operation: 'bot_messages',
              statusCode: undefined
            }
          );
          
          const retryContext: RetryContext = {
            chatId,
            position: updatedPosition,
            updateDiff,
            originalError: errorDetail
          };
          
          showRetryToast(errorDetail, retryContext, 'bot_messages');
        }
        
        // 3. AI分析再生成 (旧フロー) は一時停止
        if (ENABLE_LEGACY_AI_REGENERATION) {
          try {
            const aiResult = await regeneratePositionAnalysis(chatId, updatedPosition);
            if (!aiResult.success) {
              // AI失敗時のトースト表示
              const errorDetail = classifyError(
                new Error(aiResult.error || 'AI分析の生成に失敗しました'),
                {
                  operation: 'ai_regeneration',
                  statusCode: undefined
                }
              );
              
              const retryContext: RetryContext = {
                chatId,
                position: updatedPosition,
                originalError: errorDetail
              };
              
              showRetryToast(errorDetail, retryContext, 'ai_regeneration');
            }
          } catch (aiError) {
            console.error('AI regeneration failed:', aiError);
            
            // AI例外エラー時のトースト表示
            const errorDetail = classifyError(
              aiError instanceof Error ? aiError : new Error('AI分析でエラーが発生しました'),
              {
                operation: 'ai_regeneration',
                statusCode: undefined
              }
            );
            
            const retryContext: RetryContext = {
              chatId,
              position: updatedPosition,
              originalError: errorDetail
            };
            
            showRetryToast(errorDetail, retryContext, 'ai_regeneration');
          }
        }
      }
      
      // テレメトリ記録
      if (window.gtag) {
        window.gtag('event', 'entry_edit_saved', {
          event_category: 'position_management',
          position_symbol: updatedPosition.symbol,
          position_side: updatedPosition.side,
          chat_id: chatId || 'unknown'
        });
      }
      
    } catch (error) {
      console.error('Position update processing failed:', error);
      
      // ロールバック: Position Storeを元の状態に戻す
      updatePosition(
        oldPosition.symbol,
        oldPosition.side,
        {
          avgPrice: oldPosition.avgPrice,
          qtyTotal: oldPosition.qtyTotal,
          name: oldPosition.name,
          updatedAt: oldPosition.updatedAt,
          version: oldPosition.version
        },
        oldPosition.chatId
      );
      
      // メトリクスも元に戻す
      const rollbackMetrics = calculatePositionMetrics(oldPosition);
      setPositionMetrics(rollbackMetrics);
      
      // 親コンポーネントにも元の状態を通知
      if (onPositionUpdate) {
        onPositionUpdate(oldPosition);
      }
      
      // エラートースト表示
      showToast.error('ポジション更新に失敗しました', {
        description: error instanceof Error ? error.message : '不明なエラーが発生しました',
        duration: 5000
      });
    } finally {
      setIsUpdating(false);
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
  
  // Positionメトリクス更新
  useEffect(() => {
    const newMetrics = calculatePositionMetrics(p, undefined, riskSettings);
    setPositionMetrics(newMetrics);
  }, [p.avgPrice, p.qtyTotal, p.side, p.version]);
  
  // 色とボーダーをサイドに応じて設定
  const borderColor = p.side === 'LONG' ? 'border-emerald-200' : 'border-red-200';
  const labelBgColor = p.side === 'LONG' ? 'bg-emerald-100' : 'bg-red-100';
  const labelTextColor = p.side === 'LONG' ? 'text-emerald-600' : 'text-red-600';
  
  // 含み損益は非表示（pnlDisplay等は未使用）
  
  return (
    <>
      <div className={`rounded-xl border-2 ${borderColor} bg-white p-4 relative`} style={{boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.09)'}}>
        <div className="flex items-center justify-between mb-4">
          <div className={`px-4 py-1 rounded-full text-sm font-medium ${labelBgColor} ${labelTextColor} min-w-[80px] text-center`}>
            {p.side}
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="text-sm text-gray-500"
              data-testid="position-updated-at"
            >
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
        <div 
          className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300 whitespace-nowrap"
          data-testid="position-qty"
        >
          保有 {formatQty(p.qtyTotal)}
        </div>
        <div 
          className="bg-white rounded-full px-4 py-1.5 text-sm text-gray-900 border border-gray-300 whitespace-nowrap"
          data-testid="position-avg-price"
        >
          平均建値 {formatPrice(p.avgPrice)}
        </div>
      </div>
      
      {/* Position Metrics */}
      <div 
        className="mb-4 space-y-1"
        data-testid="position-metrics"
      >
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            {`利確目標+${(riskSettings.profitTargetPercent * 100).toFixed(0)}%:`}
          </span>
          <span className="text-green-600" data-testid="position-tp">
            ¥{new Intl.NumberFormat('ja-JP').format(Math.round(positionMetrics.profitTarget))}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            {`損切り目標 -${(riskSettings.stopLossPercent * 100).toFixed(0)}%:`}
          </span>
          <span className="text-red-600" data-testid="position-sl">
            ¥{new Intl.NumberFormat('ja-JP').format(Math.round(positionMetrics.stopLossTarget))}
          </span>
        </div>
      </div>
      
      <div className="mt-5">
        <button 
          onClick={handleSettleClick} 
          className="w-full bg-red-600 text-white text-base font-medium py-2 rounded-full hover:bg-red-700 transition-colors"
        >
          約定入力
        </button>
      </div>
      </div>
      
      {/* Context Menu */}
      <PositionContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        onEdit={handleEditModalOpen}
        onDelete={handlePositionDelete}
        position={contextMenuPosition}
      />
      
      {/* Edit Modal */}
      <EditEntryModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        chatId={chatId || p.chatId || 'default'}
        initialData={{
          positionId: `${p.symbol}:${p.side}:${p.chatId || 'default'}`,
          symbolCode: p.symbol,
          symbolName: p.name || '',
          side: p.side,
          price: p.avgPrice,
          qty: p.qtyTotal,
          note: '',
          executedAt: new Date().toISOString().slice(0, 16),
          tradeId: p.currentTradeId || '',
          version: p.version,
          chartImageId: p.chartImageId ?? null,
          aiFeedbacked: p.aiFeedbacked ?? false
        }}
        onSave={handleEditModalSave}
        onUpdateSuccess={handlePositionUpdateSuccess}
        onAddBotMessage={onAddBotMessage}
        isLoading={editModalLoading || isUpdating}
      />
    </>
  );
};

interface RightPanePositionsProps {
  chatId?: string | null;
  onAddBotMessage?: (message: { id: string; type: 'bot'; content: string; timestamp: string; testId?: string }) => void;
}

const RightPanePositions: React.FC<RightPanePositionsProps> = ({ chatId, onAddBotMessage }) => {
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
    // 明示イベントでも再取得（削除後の即時反映を補助）
    const onPositionsChanged = () => {
      const updated = chatId ? getGroups(chatId) : [];
      setGroups(updated);
    };
    window.addEventListener('positions-changed', onPositionsChanged);
    return () => {
      unsub();
      window.removeEventListener('positions-changed', onPositionsChanged);
    };
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
    <>
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
                {g.positions.filter(p => p.side === 'SHORT').map(p => <PositionCard key={`${p.symbol}:SHORT:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} onPositionUpdate={() => { const updated = chatId ? getGroups(chatId) : []; setGroups(updated); }} onAddBotMessage={onAddBotMessage} />)}
                {g.positions.filter(p => p.side === 'LONG').map(p => <PositionCard key={`${p.symbol}:LONG:${p.chatId}`} p={p} chatId={chatId} findByCode={findByCode} onPositionUpdate={() => { const updated = chatId ? getGroups(chatId) : []; setGroups(updated); }} onAddBotMessage={onAddBotMessage} />)}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Toast Container for Bot/AI failure notifications */}
      <ToastContainer position="top-right" maxToasts={3} />
    </>
  );
};

export default RightPanePositions;

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
