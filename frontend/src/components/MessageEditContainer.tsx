import React, { useState, useCallback, useEffect } from 'react';
import MessageItem from './MessageItem';
import ChatInputCard from './ChatInputCard';
import EditEntryModal from './EditEntryModal';
import EditExitModal from './EditExitModal';
import type { ChatMessage, EntryPayload, ExitPayload } from '../types/chat';
import { updateChatMessage, undoChatMessage, generateAIReply } from '../services/api';
import { canUndoMessage } from '../utils/messageUtils';
import { recordEntryEdited } from '../lib/auditLogger';
import type { EntryAuditSnapshot } from '../lib/auditLogger';

interface MessageEditContainerProps {
  messages: ChatMessage[];
  currentUserId: string;
  chatId: string;
  onMessagesUpdate: (messages: ChatMessage[]) => void;
  onImageClick?: (imageUrl: string) => void;
}

interface EditState {
  isEditing: boolean;
  messageId?: string;
  messageType?: 'TEXT' | 'ENTRY' | 'EXIT';
  initialData?: any;
}

const MessageEditContainer: React.FC<MessageEditContainerProps> = ({
  messages,
  currentUserId,
  chatId,
  onMessagesUpdate,
  onImageClick
}) => {
  const [editState, setEditState] = useState<EditState>({ isEditing: false });
  const [isLoading, setIsLoading] = useState(false);
  const [textEditValue, setTextEditValue] = useState('');

  const handleEditMessage = useCallback((message: ChatMessage) => {
    if (message.type === 'TEXT') {
      setTextEditValue(message.text);
      setEditState({
        isEditing: true,
        messageId: message.id,
        messageType: 'TEXT'
      });
    } else if (message.type === 'ENTRY') {
      setEditState({
        isEditing: true,
        messageId: message.id,
        messageType: 'ENTRY',
        initialData: message.payload
      });
    } else if (message.type === 'EXIT') {
      setEditState({
        isEditing: true,
        messageId: message.id,
        messageType: 'EXIT',
        initialData: message.payload
      });
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditState({ isEditing: false });
    setTextEditValue('');
  }, []);

  const handleTextUpdate = useCallback(async (text: string) => {
    if (!editState.messageId || editState.messageType !== 'TEXT') return;

    setIsLoading(true);
    try {
      const updatedMessage = await updateChatMessage(editState.messageId, {
        type: 'TEXT',
        text
      });

      const updatedMessages = messages.map(msg =>
        msg.id === editState.messageId ? updatedMessage : msg
      );

      onMessagesUpdate(updatedMessages);
      
      await generateAIReply(chatId, updatedMessage.id);
      
      handleCancelEdit();
    } catch (error) {
      console.error('Failed to update message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [editState, messages, onMessagesUpdate, chatId]);

  const sanitizeNote = (note?: string) => (note ? note.slice(0, 120) : undefined);

  const handleEntryUpdate = useCallback(async (
    data: EntryPayload,
    context?: { regenerateEnabled: boolean; planRegenerated: boolean }
  ) => {
    if (!editState.messageId || editState.messageType !== 'ENTRY') return;

    setIsLoading(true);
    try {
      const messageId = editState.messageId;
      const originalMessage = messages.find(msg => msg.id === messageId);

      const updatedMessage = await updateChatMessage(messageId, {
        type: 'ENTRY',
        payload: data
      });

      const updatedMessages = messages.map(msg =>
        msg.id === messageId ? updatedMessage : msg
      );

      onMessagesUpdate(updatedMessages);
      
      await generateAIReply(chatId, updatedMessage.id);
      
      const beforeSnapshot: EntryAuditSnapshot | null = originalMessage && originalMessage.type === 'ENTRY'
        ? {
            symbolCode: originalMessage.payload.symbolCode,
            side: originalMessage.payload.side,
            price: originalMessage.payload.price,
            qty: originalMessage.payload.qty,
            note: sanitizeNote(originalMessage.payload.note),
            tradeId: originalMessage.payload.tradeId,
            chartPattern: originalMessage.payload.chartPattern,
          }
        : null;

      const afterSnapshot: EntryAuditSnapshot | null = updatedMessage.type === 'ENTRY'
        ? {
            symbolCode: updatedMessage.payload.symbolCode,
            side: updatedMessage.payload.side,
            price: updatedMessage.payload.price,
            qty: updatedMessage.payload.qty,
            note: sanitizeNote(updatedMessage.payload.note),
            tradeId: updatedMessage.payload.tradeId,
            chartPattern: updatedMessage.payload.chartPattern,
          }
        : null;

      recordEntryEdited({
        entryId: messageId,
        before: beforeSnapshot,
        after: afterSnapshot,
        actorId: currentUserId,
        timestamp: updatedMessage.updatedAt ?? new Date().toISOString(),
        regenerateFlag: !!(context?.regenerateEnabled && context?.planRegenerated),
      });

      handleCancelEdit();
    } catch (error) {
      console.error('Failed to update entry message:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [editState, messages, onMessagesUpdate, chatId, currentUserId, handleCancelEdit]);

  const handleExitUpdate = useCallback(async (data: ExitPayload) => {
    if (!editState.messageId || editState.messageType !== 'EXIT') return;

    setIsLoading(true);
    try {
      const updatedMessage = await updateChatMessage(editState.messageId, {
        type: 'EXIT',
        payload: data
      });

      const updatedMessages = messages.map(msg =>
        msg.id === editState.messageId ? updatedMessage : msg
      );

      onMessagesUpdate(updatedMessages);
      
      await generateAIReply(chatId, updatedMessage.id);
      
      handleCancelEdit();
    } catch (error) {
      console.error('Failed to update exit message:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [editState, messages, onMessagesUpdate, chatId]);

  const handleUndoMessage = useCallback(async (message: ChatMessage) => {
    if (!canUndoMessage(message)) return;

    setIsLoading(true);
    try {
      await undoChatMessage(message.id);
      
      const updatedMessages = messages.filter(msg => msg.id !== message.id);
      onMessagesUpdate(updatedMessages);
      
      if (updatedMessages.length > 0) {
        const lastUserMessage = updatedMessages
          .filter(msg => msg.authorId === currentUserId)
          .pop();
        
        if (lastUserMessage) {
          await generateAIReply(chatId, lastUserMessage.id);
        }
      }
    } catch (error) {
      console.error('Failed to undo message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, onMessagesUpdate, currentUserId, chatId]);

  return (
    <>
      <div className="space-y-4">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            onEdit={handleEditMessage}
            onUndo={handleUndoMessage}
            onImageClick={onImageClick}
            canUndo={canUndoMessage(message)}
          />
        ))}
      </div>

      {editState.isEditing && editState.messageType === 'TEXT' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-50">
          <ChatInputCard
            value={textEditValue}
            onChange={setTextEditValue}
            onSubmit={handleTextUpdate}
            isLoading={isLoading}
            editMode={{
              isEditing: true,
              messageId: editState.messageId!,
              onCancel: handleCancelEdit
            }}
          />
        </div>
      )}

      <EditEntryModal
        isOpen={editState.isEditing && editState.messageType === 'ENTRY'}
        onClose={handleCancelEdit}
        initialData={editState.initialData}
        onSave={handleEntryUpdate}
        isLoading={isLoading}
      />

      <EditExitModal
        isOpen={editState.isEditing && editState.messageType === 'EXIT'}
        onClose={handleCancelEdit}
        initialData={editState.initialData}
        onSave={handleExitUpdate}
        isLoading={isLoading}
      />
    </>
  );
};

export default MessageEditContainer;
