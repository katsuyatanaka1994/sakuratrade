import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { loadSymbols, SymbolItem } from '../utils/symbols';

const FUSE_OPTS: Fuse.IFuseOptions<SymbolItem> = {
  keys: ['code', 'name', 'kana', 'romaji'],
  threshold: 0.3,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

export function useSymbolSuggest() {
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await loadSymbols();
      setSymbols(list);
      setReady(true);
    })();
  }, []);

  const fuse = useMemo(() => (symbols.length ? new Fuse(symbols, FUSE_OPTS) : null), [symbols]);

  function search(q: string, limit = 5): SymbolItem[] {
    if (!fuse || !q || q.length < 2) return [];
    return fuse.search(q).slice(0, limit).map(r => r.item);
  }

  function findByCode(code: string): SymbolItem | undefined {
    return symbols.find(s => s.code === code);
  }

  return { ready, search, findByCode };
}

