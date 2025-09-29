import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from './UI/utils';

interface ChartImageUploaderProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  onError?: (reason: 'type' | 'size' | 'other') => void;
  acceptMime?: string[];
  maxSizeMB?: number;
  showPreview?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = ['image/png', 'image/jpeg'];
const DEFAULT_MAX_MB = 10;

const bytesFromMB = (mb: number) => mb * 1024 * 1024;

const ChartImageUploader: React.FC<ChartImageUploaderProps> = ({
  value,
  onChange,
  onError,
  acceptMime = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_MB,
  showPreview = false,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (!showPreview) {
      setPreviewUrl('');
      return;
    }

    if (!value) {
      setPreviewUrl('');
      return;
    }

    const objectUrl = URL.createObjectURL(value);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [value, showPreview]);

  const emitError = useCallback(
    (reason: 'type' | 'size' | 'other', message: string) => {
      setError(message);
      onError?.(reason);
    },
    [onError]
  );

  const clearError = useCallback(() => setError(''), []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      const file = files[0];

      if (!acceptMime.includes(file.type)) {
        emitError('type', 'png / jpeg 以外のファイルはアップロードできません');
        return;
      }

      if (file.size > bytesFromMB(maxSizeMB)) {
        emitError('size', `ファイルサイズは${maxSizeMB}MB以下にしてください`);
        return;
      }

      clearError();
      onChange(file);
    },
    [acceptMime, clearError, emitError, maxSizeMB, onChange]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files);
      event.target.value = '';
    },
    [handleFiles]
  );

  const handleClear = useCallback(() => {
    clearError();
    onChange(null);
  }, [clearError, onChange]);

  const hasFile = Boolean(value);

  return (
    <div className={cn('w-full', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={handleDrop}
        className="border border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-center space-y-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
        data-testid="chart-image-uploader"
      >
        <div className="flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-gray-500" aria-hidden="true" />
          <span className="font-semibold text-gray-700">チャート画像をアップロード</span>
        </div>
        <span className="text-sm text-gray-500">AIが改善のヒントを提案します✨</span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={acceptMime.join(',')}
          onChange={handleInputChange}
        />
      </div>
      <div className="text-xs text-gray-400 mt-1">対応形式：png / jpeg ・ 最大{maxSizeMB}MB</div>

      {hasFile && showPreview && previewUrl && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">プレビュー</span>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-700"
              onClick={handleClear}
            >
              クリア
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <img
              src={previewUrl}
              alt="選択したチャート画像"
              className="max-h-32 w-full object-contain bg-white"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-500" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default ChartImageUploader;
