import React, { useEffect, useRef, useState } from 'react';

interface PositionContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  position: { x: number; y: number };
}

const PositionContextMenu: React.FC<PositionContextMenuProps> = ({
  isOpen,
  onClose,
  onEdit,
  onDelete,
  position
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuPosition, setMenuPosition] = useState(position);

  // Handle clicks outside menu to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstButton = menuRef.current.querySelector('button');
      if (firstButton) {
        firstButton.focus();
      }
    }
  }, [isOpen]);

  // メニュー位置調整（画面からはみ出さないように）
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let adjustedPosition = { ...position };
    const menuWidth = 120; // min-w-[120px]に合わせる
    const menuHeight = rect.height || 80; // 推定の高さ
    const margin = 8; // マージン

    // 編集アイコンの近くに配置するための調整
    // デフォルトはアイコンの左下
    let targetX = position.x - menuWidth / 2; // アイコンの中央に合わせる
    let targetY = position.y + margin; // アイコンの下に少し間隔を空ける

    // 右端からはみ出る場合：左側に配置
    if (targetX + menuWidth > viewport.width - margin) {
      targetX = viewport.width - menuWidth - margin;
    }
    
    // 左端からはみ出る場合：右側に配置
    if (targetX < margin) {
      targetX = margin;
    }

    // 下端からはみ出る場合：上側に配置
    if (targetY + menuHeight > viewport.height - margin) {
      targetY = position.y - menuHeight - margin; // アイコンの上に配置
    }
    
    // 上端からはみ出る場合：下側に配置
    if (targetY < margin) {
      targetY = margin;
    }

    adjustedPosition.x = targetX;
    adjustedPosition.y = targetY;

    setMenuPosition(adjustedPosition);
  }, [isOpen, position]);

  if (!isOpen) return null;

  const handleEdit = () => {
    // Record telemetry
    if (typeof window !== 'undefined') {
      (window as any).gtag?.('event', 'position_menu_opened', {
        action: 'edit',
        source: 'position_card'
      });
    }
    
    onEdit();
    onClose();
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete();
    }
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <>
      {/* Context Menu */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="ポジション操作メニュー"
        className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
        style={{
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
        }}
      >
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
          onClick={handleEdit}
        >
          編集
        </button>
        {onDelete && (
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-100 focus:outline-none"
            onClick={handleDelete}
          >
            削除
          </button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={handleCancelDelete}
          />
          <div 
            ref={deleteDialogRef}
            className="relative bg-white rounded-lg shadow-xl p-6 mx-4 max-w-md w-full"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              ポジションを削除
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              このポジションを削除してもよろしいですか？この操作は取り消せません。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={handleCancelDelete}
              >
                キャンセル
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={handleConfirmDelete}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PositionContextMenu;