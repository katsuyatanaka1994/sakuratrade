import React, { useEffect, useRef, useState } from 'react';

interface PositionContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  position: { x: number; y: number };
}

const PositionContextMenu: React.FC<PositionContextMenuProps> = ({
  isOpen,
  onClose,
  onEdit,
  position
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-40 bg-black bg-opacity-10"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Context Menu */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="ポジション操作メニュー"
        className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -8px)' // Center horizontally, offset vertically
        }}
      >
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
          onClick={handleEdit}
        >
          編集
        </button>
      </div>
    </>
  );
};

export default PositionContextMenu;