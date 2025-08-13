import React, { useEffect, useRef, useState } from 'react';
import { useSymbolSuggest } from '../hooks/useSymbolSuggest';
import type { SymbolItem } from '../utils/symbols';
import './autocomplete.css';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: SymbolItem) => void;
  placeholder?: string;
  autoBadge?: boolean; // 自動入力時のバッジ表示
};

export default function AutocompleteSymbol({ value, onChange, onSelect, placeholder, autoBadge }: Props) {
  const { ready, search } = useSymbolSuggest();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SymbolItem[]>([]);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onChange(q);
    if (!ready || q.length < 2) { setItems([]); setOpen(false); return; }
    const res = search(q, 5);
    setItems(res);
    setActive(0);
    setOpen(res.length > 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a+1, items.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a-1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (items[active]) choose(items[active]); }
    if (e.key === 'Escape')    { setOpen(false); }
  }

  function choose(item: SymbolItem) {
    onSelect(item);
    setOpen(false);
  }

  return (
    <div className="ac-root" ref={rootRef}>
      <div className="ac-input-wrap">
        <input
          className="ac-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? '銘柄コードまたは名称'}
          autoComplete="off"
        />
        {autoBadge && <span className="ac-badge">自動入力</span>}
      </div>
      {open && (
        <div className="ac-pop">
          {items.map((it, i) => (
            <div
              key={it.code}
              className={`ac-item ${i===active ? 'is-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(it); }}
            >
              <div className="ac-name">{it.name}</div>
              <div className="ac-meta">{it.code}／{it.market ?? ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
