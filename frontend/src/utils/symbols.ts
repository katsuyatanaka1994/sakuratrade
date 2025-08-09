export type SymbolItem = {
  code: string;
  name: string;
  market?: string;
  kana?: string;
  romaji?: string;
  sector33?: string;
  sector17?: string;
  product?: string;
  ticker?: string;
};

export type ChatMsg = { id: string; chatId: string; text: string; createdAt: number };

let _symbolsCache: SymbolItem[] | null = null;

// 4桁コード or 4桁+".T" を検出
const CODE_RE = /(^|\s)(\d{4})(?:\.T)?(?=\b|[^\d])/g;

export async function loadSymbols(): Promise<SymbolItem[]> {
  if (_symbolsCache) return _symbolsCache;
  try {
    const res = await fetch('/data/symbols.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error(String(res.status));
    _symbolsCache = await res.json();
  } catch (_) {
    _symbolsCache = [];
  }
  return _symbolsCache!;
}

export function normalizeCode(maybe: string): string | null {
  const m = maybe.match(/^\d{4}$/) || maybe.match(/^(\d{4})\.T$/i);
  return m ? (m as any)[1] ?? m[0] : null;
}

export function extractCodesFromText(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CODE_RE)) out.add((m as any)[2]);
  return Array.from(out);
}

export function extractSymbolsFromText(text: string, dict: SymbolItem[]): string[] {
  const codes = new Set<string>(extractCodesFromText(text));
  // 名称・エイリアス（kana/romaji）部分一致
  const t = text.toLowerCase();
  for (const s of dict) {
    if (!s.name) continue;
    const nameHit = t.includes(s.name.toLowerCase());
    const kanaHit = s.kana ? t.includes((s.kana as string).toLowerCase()) : false;
    const romajiHit = s.romaji ? t.includes((s.romaji as string).toLowerCase()) : false;
    if (nameHit || kanaHit || romajiHit) codes.add(s.code);
  }
  // 存在しないコードは除外
  const valid = new Set(dict.map(d => d.code));
  return Array.from(codes).filter(c => valid.has(c));
}

export function getLatestSymbolFromChat(messages: ChatMsg[], dict: SymbolItem[]): string | null {
  const sorted = [...messages].sort((a,b) => b.createdAt - a.createdAt);
  for (const msg of sorted) {
    const cands = extractSymbolsFromText(msg.text, dict);
    if (cands.length) return cands[0]; // 先頭出現を採用
  }
  return null;
}

