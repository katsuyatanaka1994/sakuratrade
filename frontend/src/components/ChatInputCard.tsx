import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, X } from 'lucide-react';
import { Button } from './UI/button';

interface ChatInputCardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onFileUpload?: (file: File) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  editMode?: {
    isEditing: boolean;
    messageId: string;
    onCancel: () => void;
  };
}

const ChatInputCard: React.FC<ChatInputCardProps> = ({
  value,
  onChange,
  onSubmit,
  onFileUpload,
  isLoading = false,
  disabled = false,
  placeholder = "メッセージを入力...",
  editMode
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editMode?.isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(value.length, value.length);
    }
  }, [editMode?.isEditing, value]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!value.trim() || isLoading || disabled) {
      return;
    }

    onSubmit(value);
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    
    if (e.key === 'Escape' && editMode?.isEditing) {
      editMode.onCancel();
    }
  };

  const handleFileSelect = (file: File) => {
    if (onFileUpload) {
      onFileUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const getPlaceholderText = () => {
    if (editMode?.isEditing) {
      return "メッセージを編集... (Enterで更新、Escでキャンセル)";
    }
    return placeholder;
  };

  const getSubmitButtonText = () => {
    if (isLoading) {
      return editMode?.isEditing ? '更新中...' : '送信中...';
    }
    return editMode?.isEditing ? '更新' : '送信';
  };

  return (
    <div className="relative">
      {/* Edit mode header */}
      {editMode?.isEditing && (
        <div className="bg-blue-50 border border-blue-200 rounded-t-xl px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-blue-700 font-medium">
              メッセージを編集中
            </span>
          </div>
          <button
            onClick={editMode.onCancel}
            className="text-blue-400 hover:text-blue-600 transition-colors"
            aria-label="編集をキャンセル"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`bg-white shadow-lg border border-gray-200 ${
          editMode?.isEditing ? 'rounded-b-xl' : 'rounded-xl'
        } p-4 ${dragOver ? 'bg-blue-50 border-blue-300' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex items-end space-x-3">
          {/* File upload button */}
          {onFileUpload && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isLoading}
              className="flex-shrink-0 mb-0.5"
              aria-label="画像をアップロード"
            >
              <Upload size={18} />
            </Button>
          )}

          {/* Text input */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholderText()}
              disabled={disabled || isLoading}
              className="w-full min-h-[44px] max-h-32 px-3 py-2.5 border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       resize-none text-sm leading-relaxed
                       disabled:bg-gray-50 disabled:text-gray-500"
              rows={1}
            />
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={!value?.trim() || disabled || isLoading}
            className={`flex-shrink-0 mb-0.5 ${
              editMode?.isEditing 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-green-600 hover:bg-green-700'
            } text-white`}
            aria-label={editMode?.isEditing ? 'メッセージを更新' : 'メッセージを送信'}
          >
            <Send size={18} className="mr-1" />
            {getSubmitButtonText()}
          </Button>
        </div>

        {/* Drag and drop overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Upload size={32} className="mx-auto text-blue-500 mb-2" />
              <p className="text-sm text-blue-700 font-medium">
                画像をドロップしてアップロード
              </p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        {onFileUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
        )}
      </form>
    </div>
  );
};

export default ChatInputCard;