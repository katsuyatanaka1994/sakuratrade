import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  altText = "拡大画像" 
}) => {
  const imgWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0); // translateX
  const [ty, setTy] = useState(0); // translateY
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef<{x:number;y:number}|null>(null);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden'; // スクロールを無効化
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset'; // スクロールを復元
    };
  }, [isOpen, onClose, imageUrl]);

  // リセットは画像切替/オープンで
  useEffect(() => {
    if (isOpen) {
      setScale(1); setTx(0); setTy(0); setDragging(false); lastPos.current = null;
    }
  }, [isOpen, imageUrl]);

  const clampScale = (v: number) => Math.min(4, Math.max(0.5, v));
  const zoom = (delta: number, center?: {x:number;y:number}) => {
    setScale(prev => {
      const next = clampScale(prev + delta);
      if (center && imgWrapperRef.current) {
        // 画面座標の中心基準でズーム位置を調整（簡易）
        const rect = imgWrapperRef.current.getBoundingClientRect();
        const cx = center.x - rect.left - rect.width/2;
        const cy = center.y - rect.top - rect.height/2;
        const ratio = next/prev - 1;
        setTx(t => t - cx * ratio);
        setTy(t => t - cy * ratio);
      }
      return next;
    });
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom(delta, { x: e.clientX, y: e.clientY });
  };

  const startDrag: React.MouseEventHandler<HTMLDivElement> = (e) => {
    setDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const duringDrag: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!dragging || !lastPos.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setTx(t => t + dx);
    setTy(t => t + dy);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => { setDragging(false); lastPos.current = null; };

  const resetView = () => { setScale(1); setTx(0); setTy(0); };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* モーダル背景 */}
      <div 
        className="relative max-w-[95vw] max-h-[95vh] p-4"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200"
          aria-label="モーダルを閉じる"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>

        {/* 拡大画像（パン・ズーム対応） */}
        <div
          ref={imgWrapperRef}
          className={`relative overflow-hidden rounded-lg shadow-2xl bg-black/20 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ width: '80vw', height: '80vh' }}
          onMouseDown={startDrag}
          onMouseMove={duringDrag}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onDoubleClick={() => zoom(scale >= 2 ? - (scale - 1) : +1)}
        >
          <img
            src={imageUrl}
            alt={altText}
            className="absolute top-1/2 left-1/2 max-w-none select-none"
            style={{ transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`, userSelect: 'none' }}
            draggable={false}
          />
        </div>

        {/* コントロールバー */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex items-center gap-2 bg-white/90 backdrop-blur rounded-full px-3 py-1 shadow-lg">
          <button className="px-2 py-1 text-sm" onClick={() => zoom(-0.2)}>－</button>
          <span className="text-xs text-gray-600 w-10 text-center">{Math.round(scale*100)}%</span>
          <button className="px-2 py-1 text-sm" onClick={() => zoom(+0.2)}>＋</button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button className="px-2 py-1 text-sm" onClick={resetView}>リセット</button>
          <a className="px-2 py-1 text-sm" href={imageUrl} download>保存</a>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
