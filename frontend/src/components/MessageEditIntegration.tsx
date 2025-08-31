import React, { useState, useCallback } from 'react';
import { ChatMessage, LegacyMessage, EntryPayload, ExitPayload } from '../types/chat';
import { updateChatMessage, undoChatMessage, generateAIReply } from '../services/api';
import { canUndoMessage } from '../utils/messageUtils';
import MessageItem from './MessageItem';
import EditEntryModal from './EditEntryModal';
import EditExitModal from './EditExitModal';
import ChatInputCard from './ChatInputCard';

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
      // Regular message submission
      onMessageSubmit(text);
      return;
    }

    try {
      setIsUpdating(true);
      
      // Update the message
      await updateChatMessage(editingTextMessage.messageId, {
        type: 'TEXT',
        text: text
      });
      
      // Update local message list
      if (onMessagesUpdate) {
        const updatedMessages = messages.map(msg => {
          if (msg.id === editingTextMessage.messageId) {
            if ('content' in msg) {
              // Legacy message
              return { ...msg, content: text };
            } else {
              // ChatMessage
              return { ...msg, text: text, updatedAt: new Date().toISOString() };
            }
          }
          return msg;
        });
        onMessagesUpdate(updatedMessages);
      }
      
      // Clear edit mode
      setEditingTextMessage(null);
      onChatInputChange('');
      
      // Generate AI reply after update
      if (chatId) {
        try {
          await generateAIReply(chatId, editingTextMessage.messageId);
        } catch (error) {
          console.error('Failed to generate AI reply:', error);
        }
      }
      
    } catch (error) {
      console.error('Failed to update text message:', error);
      // Handle error - could show toast notification
    } finally {
      setIsUpdating(false);
    }
  }, [editingTextMessage, messages, onMessagesUpdate, onMessageSubmit, onChatInputChange]);

  const handleEntryModalSave = useCallback(async (data: EntryPayload) => {
    if (!editEntryModal.messageId) return;

    try {
      await updateChatMessage(editEntryModal.messageId, {
        type: 'ENTRY',
        payload: data
      });
      
      // Update local message list
      if (onMessagesUpdate) {
        const updatedMessages = messages.map(msg => {
          if (msg.id === editEntryModal.messageId && !('content' in msg)) {
            return { ...msg, payload: data, updatedAt: new Date().toISOString() };
          }
          return msg;
        });
        onMessagesUpdate(updatedMessages);
      }
      
      // Generate AI reply after update
      if (chatId) {
        try {
          await generateAIReply(chatId, editEntryModal.messageId);
        } catch (error) {
          console.error('Failed to generate AI reply:', error);
        }
      }
      
    } catch (error) {
      console.error('Failed to update entry message:', error);
      throw error; // Re-throw to let modal handle the error
    }
  }, [editEntryModal.messageId, messages, onMessagesUpdate]);

  const handleExitModalSave = useCallback(async (data: ExitPayload) => {
    if (!editExitModal.messageId) return;

    try {
      await updateChatMessage(editExitModal.messageId, {
        type: 'EXIT',
        payload: data
      });
      
      // Update local message list
      if (onMessagesUpdate) {
        const updatedMessages = messages.map(msg => {
          if (msg.id === editExitModal.messageId && !('content' in msg)) {
            return { ...msg, payload: data, updatedAt: new Date().toISOString() };
          }
          return msg;
        });
        onMessagesUpdate(updatedMessages);
      }
      
      // Generate AI reply after update
      if (chatId) {
        try {
          await generateAIReply(chatId, editExitModal.messageId);
        } catch (error) {
          console.error('Failed to generate AI reply:', error);
        }
      }
      
    } catch (error) {
      console.error('Failed to update exit message:', error);
      throw error; // Re-throw to let modal handle the error
    }
  }, [editExitModal.messageId, messages, onMessagesUpdate, chatId]);

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
        const updatedMessages = messages.filter(msg => msg.id !== chatMessage.id);
        onMessagesUpdate(updatedMessages);
      }
      
      // Generate AI reply after undo
      if (chatId) {
        // Find the last user message to use as context for AI reply
        const lastUserMessage = messages
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
  }, [messages, onMessagesUpdate, currentUserId, chatId]);

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