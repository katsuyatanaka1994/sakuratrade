import React, { useState, useEffect, useRef } from 'react';
import { ErrorDetail, ErrorSeverity } from '../../lib/errorHandling';

// トースト表示タイプ
export type ToastType = 'error' | 'warning' | 'info' | 'success';

// アクションボタンの設定
export interface ToastActionButton {
  label: string;
  onClick: () => void | Promise<void>;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

// トーストのプロパティ
export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  actionButton?: ToastActionButton;
  onClose?: () => void;
  duration?: number; // ミリ秒、0で自動閉じなし
  persistent?: boolean; // 手動閉じのみ
  errorDetail?: ErrorDetail;
}

// トーストの位置設定
export type ToastPosition = 
  | 'top-right' 
  | 'top-left' 
  | 'bottom-right' 
  | 'bottom-left' 
  | 'top-center' 
  | 'bottom-center';

/**
 * 単一トーストコンポーネント
 */
const ToastItem: React.FC<ToastProps & { onAnimationEnd?: () => void; isExiting?: boolean }> = ({
  id,
  type,
  message,
  description,
  actionButton,
  onClose,
  onAnimationEnd,
  isExiting = false,
  errorDetail
}) => {
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // タイプ別のスタイル定義
  const getTypeStyles = (type: ToastType) => {
    const styles = {
      error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600',
        iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
        text: 'text-red-800'
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-600',
        iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z',
        text: 'text-yellow-800'
      },
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600',
        iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        text: 'text-blue-800'
      },
      success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600',
        iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        text: 'text-green-800'
      }
    };
    return styles[type];
  };

  const typeStyles = getTypeStyles(type);

  // アクションボタンのクリック処理
  const handleActionClick = async () => {
    if (!actionButton || isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      await actionButton.onClick();
    } catch (error) {
      console.error('Toast action failed:', error);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div
      className={`
        relative w-full max-w-sm mx-auto bg-white rounded-lg border shadow-lg pointer-events-auto
        transition-all duration-300 ease-in-out transform
        ${
          isExiting
            ? 'translate-x-full opacity-0 scale-95'
            : 'translate-x-0 opacity-100 scale-100'
        }
        ${typeStyles.bg} ${typeStyles.border}
      `}
      data-testid="toast"
      data-toast-id={id}
      data-toast-type={type}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="p-4">
        <div className="flex items-start">
          {/* アイコン */}
          <div className="flex-shrink-0">
            <svg 
              className={`w-5 h-5 ${typeStyles.icon}`} 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path d={typeStyles.iconPath} />
            </svg>
          </div>
          
          {/* メッセージ部分 */}
          <div className="ml-3 flex-1">
            <div className={`text-sm font-medium ${typeStyles.text}`}>
              {message}
            </div>
            {description && (
              <div className={`mt-1 text-sm ${typeStyles.text} opacity-75`}>
                {description}
              </div>
            )}
            
            {/* アクションボタン */}
            {actionButton && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleActionClick}
                  disabled={isActionLoading}
                  className={`
                    inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded 
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${
                      actionButton.variant === 'secondary'
                        ? `bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500`
                        : `${typeStyles.icon} bg-white hover:bg-gray-50 focus:ring-offset-2`
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-200
                  `}
                  data-testid="toast-action"
                >
                  {isActionLoading && (
                    <svg 
                      className="animate-spin -ml-1 mr-2 h-3 w-3" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  {actionButton.label}
                </button>
              </div>
            )}
          </div>
          
          {/* 閉じるボタン */}
          <div className="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              onClick={onClose}
              className={`
                inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2
                ${typeStyles.text} hover:${typeStyles.text} focus:ring-gray-500
                transition-colors duration-200
              `}
              data-testid="toast-close"
            >
              <span className="sr-only">閉じる</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * トースト管理コンテナ
 */
export interface ToastContainerProps {
  position?: ToastPosition;
  maxToasts?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ 
  position = 'top-right',
  maxToasts = 3
}) => {
  const [toasts, setToasts] = useState<(ToastProps & { isExiting?: boolean })[]>([]);

  // ポジション別のコンテナスタイル
  const getPositionStyles = (position: ToastPosition) => {
    const styles = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
      'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
    };
    return styles[position];
  };

  // トースト追加
  const addToast = (toast: ToastProps) => {
    setToasts(prev => {
      const newToasts = [...prev, toast];
      // 最大表示数を超える場合は古いものから削除
      if (newToasts.length > maxToasts) {
        return newToasts.slice(-maxToasts);
      }
      return newToasts;
    });

    // 自動閉じ処理
    if (toast.duration && toast.duration > 0 && !toast.persistent) {
      setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);
    }
  };

  // トースト削除（アニメーション付き）
  const removeToast = (id: string) => {
    setToasts(prev => 
      prev.map(toast => 
        toast.id === id ? { ...toast, isExiting: true } : toast
      )
    );

    // アニメーション完了後に実際に削除
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  };

  // グローバル関数として公開
  useEffect(() => {
    (window as any).addToast = addToast;
    return () => {
      delete (window as any).addToast;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div 
      className={`fixed z-50 pointer-events-none space-y-2 ${getPositionStyles(position)}`}
      data-testid="toast-container"
    >
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
          onAnimationEnd={() => {
            if (toast.isExiting) {
              setToasts(prev => prev.filter(t => t.id !== toast.id));
            }
          }}
        />
      ))}
    </div>
  );
};

// トースト表示のヘルパー関数
export const showToast = {
  error: (message: string, options?: Partial<ToastProps>) => {
    const toast: ToastProps = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type: 'error',
      message,
      duration: 0, // エラーは手動閉じ
      persistent: true,
      ...options
    };
    
    if ((window as any).addToast) {
      (window as any).addToast(toast);
    }
    
    return toast.id;
  },
  
  warning: (message: string, options?: Partial<ToastProps>) => {
    const toast: ToastProps = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type: 'warning',
      message,
      duration: 5000,
      ...options
    };
    
    if ((window as any).addToast) {
      (window as any).addToast(toast);
    }
    
    return toast.id;
  },
  
  info: (message: string, options?: Partial<ToastProps>) => {
    const toast: ToastProps = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type: 'info',
      message,
      duration: 4000,
      ...options
    };
    
    if ((window as any).addToast) {
      (window as any).addToast(toast);
    }
    
    return toast.id;
  },
  
  success: (message: string, options?: Partial<ToastProps>) => {
    const toast: ToastProps = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type: 'success',
      message,
      duration: 3000,
      ...options
    };
    
    if ((window as any).addToast) {
      (window as any).addToast(toast);
    }
    
    return toast.id;
  }
};

// ErrorDetailからトーストを作成するヘルパー
export function createToastFromError(
  errorDetail: ErrorDetail,
  retryAction?: () => void | Promise<void>
): ToastProps {
  const toastType: ToastType = 
    errorDetail.severity === 'critical' ? 'error' :
    errorDetail.severity === 'high' ? 'error' :
    errorDetail.severity === 'medium' ? 'warning' : 'info';

  const actionButton: ToastActionButton | undefined = 
    errorDetail.retryable && retryAction ? {
      label: errorDetail.type.includes('BOT') ? '再送信' : 
             errorDetail.type.includes('AI') ? '再生成' : '再試行',
      onClick: retryAction,
      variant: 'primary'
    } : undefined;

  return {
    id: `error-${errorDetail.type}-${Date.now()}`,
    type: toastType,
    message: errorDetail.message,
    description: errorDetail.context?.operation ? 
      `操作: ${errorDetail.context.operation}` : undefined,
    actionButton,
    duration: 0, // エラーは手動閉じ
    persistent: true,
    errorDetail
  };
}

export default ToastItem;