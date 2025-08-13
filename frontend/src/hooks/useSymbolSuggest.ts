import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { loadSymbols, normalizeCode, hiraToKata } from '../utils/symbols';
import type { SymbolItem } from '../utils/symbols';

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
      try {
        console.log('🔍 Loading symbols...');
        const list = await loadSymbols();
        console.log(`✅ Loaded ${list.length} symbols`);
        setSymbols(list);
        setReady(true);
      } catch (error) {
        console.error('❌ Error loading symbols:', error);
        setSymbols([]);
        setReady(false);
      }
    })();
  }, []);

  const fuse = useMemo(() => (symbols.length ? new Fuse(symbols, FUSE_OPTS) : null), [symbols]);

  function search(q: string, limit = 5): SymbolItem[] {
    if (!fuse || !q || q.trim().length < 2) return [];
    const qTrim = q.trim();
    const resultsMap = new Map<string, SymbolItem>();

    // 1) まずコード正規化（例: 5803.T -> 5803）で厳密一致を優先
    const code = normalizeCode(qTrim);
    if (code) {
      const hit = symbols.find(s => s.code === code);
      if (hit) resultsMap.set(hit.code, hit);
    }

    // 2) 元のクエリでFuse検索
    for (const r of fuse.search(qTrim)) {
      const it = r.item;
      if (!resultsMap.has(it.code)) resultsMap.set(it.code, it);
      if (resultsMap.size >= limit) break;
    }

    // 3) コード正規化値でも検索（未到達分の補完）
    if (code && resultsMap.size < limit) {
      for (const r of fuse.search(code)) {
        const it = r.item;
        if (!resultsMap.has(it.code)) resultsMap.set(it.code, it);
        if (resultsMap.size >= limit) break;
      }
    }

    // 4) ひら→カナ正規化でも検索（"ふじ" -> "フジ"）
    const qKana = hiraToKata(qTrim);
    if (qKana !== qTrim && resultsMap.size < limit) {
      for (const r of fuse.search(qKana)) {
        const it = r.item;
        if (!resultsMap.has(it.code)) resultsMap.set(it.code, it);
        if (resultsMap.size >= limit) break;
      }
    }

    return Array.from(resultsMap.values()).slice(0, limit);
  }

  function findByCode(code: string): SymbolItem | undefined {
    return symbols.find(s => s.code === code);
  }

  return { ready, search, findByCode };
}
