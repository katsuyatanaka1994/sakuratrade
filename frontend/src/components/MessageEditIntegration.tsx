import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, LegacyMessage, EntryPayload, ExitPayload } from '../types/chat';
import { updateChatMessage, undoChatMessage, generateAIReply } from '../services/api';
import { canUndoMessage } from '../utils/messageUtils';
import MessageItem from './MessageItem';
import EditEntryModal from './EditEntryModal';
import EditExitModal from './EditExitModal';
import ChatInputCard from './ChatInputCard';
import { showToast } from './UI/Toast';
import { recordEntryEdited } from '../lib/auditLogger';
import type { EntryAuditSnapshot } from '../lib/auditLogger';

const cloneChatMessage = (message: ChatMessage): ChatMessage => {
  switch (message.type) {
    case 'TEXT':
      return { ...message };
    case 'ENTRY':
      return { ...message, payload: { ...message.payload } };
    case 'EXIT':
      return { ...message, payload: { ...message.payload } };
    default:
      return { ...message };
  }
};

interface MessageEditIntegrationProps {
  messages: (ChatMessage | LegacyMessage)[];
  currentUserId?: string;
  chatId?: string;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onMessageSubmit: (message: string) => void;
  onFileUpload?: (file: File) => void;
  onImageClick?: (imageUrl: string) => void;
  isLoading?: boolean;
  onMessagesUpdate?: (messages: (ChatMessage | LegacyMessage)[]) => void;
}

const sanitizeNote = (note?: string) => (note ? note.slice(0, 120) : undefined);

const createEntrySnapshotFromMessage = (message: ChatMessage | null | undefined): EntryAuditSnapshot | null => {
  if (!message || message.type !== 'ENTRY') {
    return null;
  }

  const { payload } = message;
  return {
    symbolCode: payload.symbolCode,
    side: payload.side,
    price: payload.price,
    qty: payload.qty,
    note: sanitizeNote(payload.note),
    tradeId: payload.tradeId,
    chartPattern: payload.chartPattern,
  };
};

const MessageEditIntegration: React.FC<MessageEditIntegrationProps> = ({
  messages,
  currentUserId = 'user', // Default user ID for now
  chatId = 'default-chat',
  chatInput,
  onChatInputChange,
  onMessageSubmit,
  onFileUpload,
  onImageClick,
  isLoading = false,
  onMessagesUpdate
}) => {
  const latestMessagesRef = useRef(messages);
  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  const messageSnapshots = useRef(new Map<string, ChatMessage>());
  const [pendingMessageIds, setPendingMessageIds] = useState<Set<string>>(new Set());

  const addPendingMessage = useCallback((messageId: string) => {
    setPendingMessageIds(prev => {
      if (prev.has(messageId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, []);

  const removePendingMessage = useCallback((messageId: string) => {
    setPendingMessageIds(prev => {
      if (!prev.has(messageId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  }, []);

  const applyOptimisticUpdate = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage | null) => {
      if (!onMessagesUpdate) {
        return null;
      }

      const currentMessages = latestMessagesRef.current;
      const index = currentMessages.findIndex(msg => msg.id === messageId);
      if (index === -1) {
        return null;
      }

      const target = currentMessages[index];
      if ('content' in target) {
        return null;
      }

      const snapshot = cloneChatMessage(target as ChatMessage);
      const optimisticBase = cloneChatMessage(target as ChatMessage);
      const optimisticMessage = updater(optimisticBase);
      if (!optimisticMessage) {
        return null;
      }

      const nextMessages = [...currentMessages];
      nextMessages[index] = optimisticMessage;
      messageSnapshots.current.set(messageId, snapshot);
      addPendingMessage(messageId);
      onMessagesUpdate(nextMessages);
      return { snapshot, optimisticMessage };
    },
    [addPendingMessage, onMessagesUpdate]
  );

  const finalizeMessageUpdate = useCallback(
    (messageId: string, updatedMessage: ChatMessage) => {
      const cloned = cloneChatMessage(updatedMessage);

      if (!onMessagesUpdate) {
        messageSnapshots.current.delete(messageId);
        removePendingMessage(messageId);
        return;
      }

      const currentMessages = latestMessagesRef.current;
      const index = currentMessages.findIndex(msg => msg.id === messageId);
      if (index === -1) {
        messageSnapshots.current.delete(messageId);
        removePendingMessage(messageId);
        return;
      }

      const nextMessages = [...currentMessages];
      nextMessages[index] = cloned;
      onMessagesUpdate(nextMessages);
      messageSnapshots.current.delete(messageId);
      removePendingMessage(messageId);
    },
    [onMessagesUpdate, removePendingMessage]
  );

  useEffect(() => {
    setPendingMessageIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const existingIds = new Set(messages.map(msg => msg.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existingIds.has(id)) {
          next.add(id);
        } else {
          messageSnapshots.current.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [messages]);

  const revertOptimisticUpdate = useCallback(
    (messageId: string) => {
      const snapshot = messageSnapshots.current.get(messageId);

      if (!onMessagesUpdate || !snapshot) {
        if (snapshot) {
          messageSnapshots.current.delete(messageId);
        }
        removePendingMessage(messageId);
        return;
      }

      const currentMessages = latestMessagesRef.current;
      const index = currentMessages.findIndex(msg => msg.id === messageId);
      if (index === -1) {
        messageSnapshots.current.delete(messageId);
        removePendingMessage(messageId);
        return;
      }

      const restored = cloneChatMessage(snapshot);
      const nextMessages = [...currentMessages];
      nextMessages[index] = restored;
      onMessagesUpdate(nextMessages);
      messageSnapshots.current.delete(messageId);
      removePendingMessage(messageId);
    },
    [onMessagesUpdate, removePendingMessage]
  );
  // Edit modal states
  const [editEntryModal, setEditEntryModal] = useState<{
    isOpen: boolean;
    messageId?: string;
    data?: EntryPayload;
  }>({ isOpen: false });
  
  const [editExitModal, setEditExitModal] = useState<{
    isOpen: boolean;
    messageId?: string;
    data?: ExitPayload;
  }>({ isOpen: false });
  
  // Text edit mode
  const [editingTextMessage, setEditingTextMessage] = useState<{
    messageId: string;
    originalText: string;
  } | null>(null);
  
  const [isUpdating, setIsUpdating] = useState(false);

  const handleMessageEdit = useCallback((message: ChatMessage | LegacyMessage) => {
    // Legacy message (convert to edit text mode)
    if ('content' in message) {
      setEditingTextMessage({
        messageId: message.id,
        originalText: message.content
      });
      onChatInputChange(message.content);
      return;
    }

    // New ChatMessage
    const chatMessage = message as ChatMessage;
    
    switch (chatMessage.type) {
      case 'TEXT':
        setEditingTextMessage({
          messageId: chatMessage.id,
          originalText: chatMessage.text
        });
        onChatInputChange(chatMessage.text);
        break;
        
      case 'ENTRY':
        setEditEntryModal({
          isOpen: true,
          messageId: chatMessage.id,
          data: chatMessage.payload
        });
        break;
        
      case 'EXIT':
        setEditExitModal({
          isOpen: true,
          messageId: chatMessage.id,
          data: chatMessage.payload
        });
        break;
    }
  }, [onChatInputChange]);

  const handleCancelTextEdit = useCallback(() => {
    setEditingTextMessage(null);
    onChatInputChange('');
  }, [onChatInputChange]);

  const handleTextMessageSubmit = useCallback(async (text: string) => {
    if (!editingTextMessage) {
      onMessageSubmit(text);
      return;
    }

    const messageId = editingTextMessage.messageId;
    const optimisticUpdatedAt = new Date().toISOString();
    const optimisticResult = applyOptimisticUpdate(messageId, (message) => ({
      ...message,
      text,
      updatedAt: optimisticUpdatedAt,
    }));

    try {
      setIsUpdating(true);

      const updated = await updateChatMessage(messageId, {
        type: 'TEXT',
        text,
      });

      let finalMessage: ChatMessage;
      if (updated.type === 'TEXT') {
        finalMessage = {
          ...updated,
          updatedAt: updated.updatedAt ?? optimisticUpdatedAt,
        };
      } else {
        const base = optimisticResult?.optimisticMessage ?? cloneChatMessage(updated as ChatMessage);
        finalMessage = {
          ...base,
          text,
          updatedAt: (updated as ChatMessage).updatedAt ?? optimisticUpdatedAt,
        };
      }

      finalizeMessageUpdate(messageId, finalMessage);

      setEditingTextMessage(null);
      onChatInputChange('');

      if (chatId) {
        try {
          await generateAIReply(chatId, messageId);
        } catch (error) {
          console.error('Failed to generate AI reply:', error);
        }
      }
    } catch (error) {
      revertOptimisticUpdate(messageId);
      const errorMessage = error instanceof Error ? error.message : 'メッセージの更新に失敗しました';
      if (/409/.test(errorMessage) || /conflict/i.test(errorMessage)) {
        showToast.warning('他のユーザーが先に更新しました。最新の内容を確認してください。');
      } else {
        showToast.error('メッセージの更新に失敗しました', { description: errorMessage });
      }
      onChatInputChange(editingTextMessage.originalText);
      console.error('Failed to update text message:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [
    editingTextMessage,
    applyOptimisticUpdate,
    finalizeMessageUpdate,
    revertOptimisticUpdate,
    onMessageSubmit,
    onChatInputChange,
    chatId,
  ]);

  const handleEntryModalSave = useCallback(async (
    data: EntryPayload,
    context?: { regenerateEnabled: boolean; planRegenerated: boolean }
  ) => {
    if (!editEntryModal.messageId) return;

    const messageId = editEntryModal.messageId;
    const optimisticUpdatedAt = new Date().toISOString();
    const optimisticResult = applyOptimisticUpdate(messageId, (message) => ({
      ...message,
      payload: { ...data },
      updatedAt: optimisticUpdatedAt,
    }));

    try {
      setIsUpdating(true);

      const updated = await updateChatMessage(messageId, {
        type: 'ENTRY',
        payload: data,
      });

      let finalMessage: ChatMessage;
      if (updated.type === 'ENTRY') {
        finalMessage = {
          ...updated,
          updatedAt: updated.updatedAt ?? optimisticUpdatedAt,
        };
      } else {
        const base = optimisticResult?.optimisticMessage ?? cloneChatMessage(updated as ChatMessage);
        finalMessage = {
          ...base,
          payload: { ...data },
          updatedAt: (updated as ChatMessage).updatedAt ?? optimisticUpdatedAt,
        };
      }

      finalizeMessageUpdate(messageId, finalMessage);

      if (chatId) {
        try {
          await generateAIReply(chatId, messageId);
        } catch (error) {
          console.error('Failed to generate AI reply:', error);
        }
      }

      const beforeSnapshot = optimisticResult?.snapshot
        ? createEntrySnapshotFromMessage(optimisticResult.snapshot)
        : createEntrySnapshotFromMessage(latestMessagesRef.current.find(msg => msg.id === messageId) as ChatMessage | undefined);
      const afterSnapshot = createEntrySnapshotFromMessage(finalMessage);

      recordEntryEdited({
        entryId: messageId,
        before: beforeSnapshot,
        after: afterSnapshot,
        actorId: currentUserId,
        timestamp: finalMessage.updatedAt ?? new Date().toISOString(),
        regenerateFlag: !!(context?.regenerateEnabled && context?.planRegenerated),
      });
    } catch (error) {
      revertOptimisticUpdate(messageId);
      const errorMessage = error instanceof Error ? error.message : '建値メッセージの更新に失敗しました';
      if (/409/.test(errorMessage) || /conflict/i.test(errorMessage)) {
        showToast.warning('他のユーザーが先に建値を更新しました。最新の内容を再確認してください。');
      } else {
        showToast.error('建値メッセージの更新に失敗しました', { description: errorMessage });
      }
      console.error('Failed to update entry message:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [
    editEntryModal.messageId,
    applyOptimisticUpdate,
    finalizeMessageUpdate,
    revertOptimisticUpdate,
    chatId,
    currentUserId,
  ]);

  const handleExitModalSave = useCallback(async (data: ExitPayload) => {
    if (!editExitModal.messageId) return;

    const messageId = editExitModal.messageId;
    const optimisticUpdatedAt = new Date().toISOString();
    const optimisticResult = applyOptimisticUpdate(messageId, (message) => ({
      ...message,
      payload: { ...data },
      updatedAt: optimisticUpdatedAt,
    }));

    try {
      setIsUpdating(true);

      const updated = await updateChatMessage(messageId, {
        type: 'EXIT',
        payload: data,
      });

      let finalMessage: ChatMessage;
      if (updated.type === 'EXIT') {
        finalMessage = {
          ...updated,
          updatedAt: updated.updatedAt ?? optimisticUpdatedAt,
        };
      } else {
        const base = optimisticResult?.optimisticMessage ?? cloneChatMessage(updated as ChatMessage);
        finalMessage = {
          ...base,
          payload: { ...data },
          updatedAt: (updated as ChatMessage).updatedAt ?? optimisticUpdatedAt,
        };
      }

      finalizeMessageUpdate(messageId, finalMessage);

      if (chatId) {
        try {
          await generateAIReply(chatId, messageId);
        } catch (error) {
          console.error('Failed to generate AI reply:', error);
        }
      }
    } catch (error) {
      revertOptimisticUpdate(messageId);
      const errorMessage = error instanceof Error ? error.message : '決済メッセージの更新に失敗しました';
      if (/409/.test(errorMessage) || /conflict/i.test(errorMessage)) {
        showToast.warning('他のユーザーが先に決済内容を更新しました。最新の内容を再確認してください。');
      } else {
        showToast.error('決済メッセージの更新に失敗しました', { description: errorMessage });
      }
      console.error('Failed to update exit message:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [
    editExitModal.messageId,
    applyOptimisticUpdate,
    finalizeMessageUpdate,
    revertOptimisticUpdate,
    chatId,
  ]);

  const handleMessageUndo = useCallback(async (message: ChatMessage | LegacyMessage) => {
    // Only allow undo for ChatMessage (not legacy) and EXIT type
    if ('content' in message) return;
    
    const chatMessage = message as ChatMessage;
    if (!canUndoMessage(chatMessage)) return;

    try {
      setIsUpdating(true);
      
      // Call undo API
      await undoChatMessage(chatMessage.id);
      
      // Remove message from local list
      if (onMessagesUpdate) {
        const updatedMessages = latestMessagesRef.current.filter(msg => msg.id !== chatMessage.id);
        onMessagesUpdate(updatedMessages);
      }
      
      // Generate AI reply after undo
      if (chatId) {
        // Find the last user message to use as context for AI reply
        const lastUserMessage = latestMessagesRef.current
          .filter(msg => {
            if ('content' in msg) return msg.type === 'user';
            return msg.authorId === currentUserId;
          })
          .pop();
          
        if (lastUserMessage) {
          try {
            await generateAIReply(chatId, lastUserMessage.id);
          } catch (error) {
            console.error('Failed to generate AI reply after undo:', error);
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to undo message:', error);
      // Handle error - could show toast notification
    } finally {
      setIsUpdating(false);
    }
  }, [onMessagesUpdate, currentUserId, chatId]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            onEdit={handleMessageEdit}
            onUndo={handleMessageUndo}
            onImageClick={onImageClick}
            canUndo={'content' in message ? false : canUndoMessage(message as ChatMessage)}
            isSaving={pendingMessageIds.has(message.id)}
          />
        ))}
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-200 p-4">
        <ChatInputCard
          value={chatInput}
          onChange={onChatInputChange}
          onSubmit={handleTextMessageSubmit}
          onFileUpload={onFileUpload}
          isLoading={isLoading || isUpdating}
          editMode={editingTextMessage ? {
            isEditing: true,
            messageId: editingTextMessage.messageId,
            onCancel: handleCancelTextEdit
          } : undefined}
        />
      </div>

      {/* Edit Modals */}
      <EditEntryModal
        isOpen={editEntryModal.isOpen}
        onClose={() => setEditEntryModal({ isOpen: false })}
        initialData={editEntryModal.data}
        onSave={handleEntryModalSave}
        isLoading={isUpdating}
        chatId={chatId}
        onAddBotMessage={(message) => {
          if (!onMessagesUpdate) {
            return;
          }
          const legacyMessage: LegacyMessage = {
            id: message.id,
            type: 'bot',
            content: message.content,
            timestamp: message.timestamp,
            relatedEntryId: message.relatedEntryId,
          };
          const trimmed = [...latestMessagesRef.current];
          let removed = false;
          for (let i = trimmed.length - 1; i >= 0; i -= 1) {
            const candidate = trimmed[i];
            if (candidate.type !== 'bot') {
              continue;
            }
            if (!removed && candidate.relatedEntryId && candidate.relatedEntryId === message.relatedEntryId) {
              trimmed.splice(i, 1);
              removed = true;
              break;
            }
            if (!removed && typeof candidate.content === 'string' && candidate.content.includes('🎯 取引プラン設定')) {
              trimmed.splice(i, 1);
              removed = true;
              break;
            }
          }
          const nextMessages = [...trimmed, legacyMessage];
          latestMessagesRef.current = nextMessages;
          onMessagesUpdate(nextMessages);
        }}
      />
      
      <EditExitModal
        isOpen={editExitModal.isOpen}
        onClose={() => setEditExitModal({ isOpen: false })}
        initialData={editExitModal.data}
        onSave={handleExitModalSave}
        isLoading={isUpdating}
      />
    </div>
  );
};

export default MessageEditIntegration;
