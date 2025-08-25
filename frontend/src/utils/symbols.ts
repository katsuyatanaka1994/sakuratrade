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

// 4桁コード or 4桁+".T" を検出（現在は使用停止）
// 仕様変更: 建値・数量・利確価格などとの誤認を防ぐため、4桁コード検出を無効化
// 銘柄名ベースでのみ検出する方針に変更
const CODE_RE = /(^|\s)(\d{4})(?:\.T)?(?=\b|[^\d])/g;

export async function loadSymbols(): Promise<SymbolItem[]> {
  if (_symbolsCache) return _symbolsCache;
  try {
    const res = await fetch('/data/symbols.json', { cache: 'force-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    _symbolsCache = await res.json();
  } catch (error) {
    console.error('❌ Failed to load symbols:', error);
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
  const matches = Array.from(text.matchAll(CODE_RE));
  
  for (const m of matches) {
    out.add((m as any)[2]);
  }
  
  return Array.from(out);
}

export function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

export function extractSymbolsFromText(text: string, dict: SymbolItem[]): string[] {
  const codes = new Set<string>();
  
  // 名称・エイリアス（kana/romaji）部分一致。日本語はひら→カナ正規化もかける
  const tLower = text.toLowerCase();
  const tKana = hiraToKata(text);
  
  // 数値キーワードが含まれる場合の誤認防止チェック
  const numericKeywords = ['株', '円', '価格', '建値', '決済', '利確', '損切', '数量', '買い', '売り'];
  const hasNumericContext = numericKeywords.some(keyword => text.includes(keyword));
  
  for (const s of dict) {
    if (!s.name) continue;
    
    // 銘柄名の部分一致をチェック（より厳密に）
    const nameHit = tKana.includes(s.name); // カタカナ名称
    const kanaHit = s.kana ? tKana.includes(s.kana as string) : false;
    const romajiHit = s.romaji ? tLower.includes((s.romaji as string).toLowerCase()) : false;
    
    // 銘柄名が短すぎる場合（3文字以下）は厳密一致のみ
    const isShortName = s.name.length <= 3;
    const strictNameMatch = isShortName ? 
      (tKana === s.name || tKana.split(/[\s、。！？]+/).includes(s.name)) : nameHit;
    
    // 数値文脈がある場合は、より厳密に検証
    let finalMatch = false;
    if (hasNumericContext && isShortName) {
      // 数値文脈+短い銘柄名の場合は、単語境界での完全一致のみ
      const wordBoundaryPattern = new RegExp(`(^|[\\s、。！？])${s.name}([\\s、。！？]|$)`);
      finalMatch = wordBoundaryPattern.test(text);
      // console.log(`🔍 厳密チェック "${s.name}":`, { finalMatch, pattern: wordBoundaryPattern.source });
    } else if (isShortName) {
      finalMatch = strictNameMatch;
    } else {
      finalMatch = nameHit || kanaHit || romajiHit;
    }
    
    if (finalMatch) {
      codes.add(s.code);
    }
  }
  
  return Array.from(codes);
}

export function getLatestSymbolFromChat(messages: ChatMsg[], dict: SymbolItem[]): string | null {
  const sorted = [...messages].sort((a,b) => b.createdAt - a.createdAt);
  
  for (const msg of sorted) {
    const cands = extractSymbolsFromText(msg.text, dict);
    if (cands.length) {
      return cands[0]; // 先頭出現を採用
    }
  }
  return null;
}
