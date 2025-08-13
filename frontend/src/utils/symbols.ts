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
    console.log('📡 Fetching /data/symbols.json...');
    const res = await fetch('/data/symbols.json', { cache: 'force-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    _symbolsCache = await res.json();
    console.log(`✅ Successfully loaded ${_symbolsCache.length} symbols`);
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
  console.log('🔍 コード抽出開始:', text);
  console.log('🔍 使用する正規表現:', CODE_RE);
  
  const out = new Set<string>();
  const matches = Array.from(text.matchAll(CODE_RE));
  console.log('🔍 正規表現マッチ結果:', matches);
  
  for (const m of matches) {
    console.log('🔍 マッチ詳細:', m);
    out.add((m as any)[2]);
  }
  
  const result = Array.from(out);
  console.log('🔢 抽出されたコード:', result);
  return result;
}

export function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

export function extractSymbolsFromText(text: string, dict: SymbolItem[]): string[] {
  console.log('📝 テキスト解析開始:', text);
  console.log('⚠️ 仕様変更: 4桁コードは無視し、銘柄名ベースのみで検出');
  
  // テスト用: 仕様変更の動作確認ログ
  const testCases = [
    '5803が上がっている',  // コードのみ→検出されない
    'フジクラが上がっている',  // 名前→検出される
    'フジクラ（5803）について',  // 名前+コード→名前で検出
    '建値3000円で利確5000円',  // 数値のみ→検出されない
    'フジクラを1000株買った'  // 名前+数値→名前で検出
  ];
  
  if (testCases.includes(text)) {
    console.log('🧪 テストケース検出:', text);
  }
  
  const codes = new Set<string>();
  
  // 名称・エイリアス（kana/romaji）部分一致。日本語はひら→カナ正規化もかける
  const tLower = text.toLowerCase();
  const tKana = hiraToKata(text);
  console.log('🔤 正規化テキスト:', { original: text, lower: tLower, kana: tKana });
  
  // 数値キーワードが含まれる場合の誤認防止チェック
  const numericKeywords = ['株', '円', '価格', '建値', '決済', '利確', '損切', '数量', '買い', '売り'];
  const hasNumericContext = numericKeywords.some(keyword => text.includes(keyword));
  console.log('🔢 数値文脈チェック:', { hasNumericContext, text });
  
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
      console.log(`🔍 厳密チェック "${s.name}":`, { finalMatch, pattern: wordBoundaryPattern.source });
    } else if (isShortName) {
      finalMatch = strictNameMatch;
    } else {
      finalMatch = nameHit || kanaHit || romajiHit;
    }
    
    if (finalMatch) {
      console.log('🎯 名称一致:', { 
        code: s.code, 
        name: s.name, 
        nameHit: finalMatch,
        kanaHit, 
        romajiHit,
        isShortName,
        hasNumericContext
      });
      codes.add(s.code);
    }
  }
  
  const result = Array.from(codes);
  console.log('✅ 最終検出結果（銘柄名ベースのみ、誤認防止強化）:', result);
  
  return result;
}

export function getLatestSymbolFromChat(messages: ChatMsg[], dict: SymbolItem[]): string | null {
  console.log('🔍 getLatestSymbolFromChat 開始:', {
    messageCount: messages.length,
    dictCount: dict.length
  });
  
  const sorted = [...messages].sort((a,b) => b.createdAt - a.createdAt);
  console.log('📅 時系列ソート後のメッセージ:', sorted.map(m => ({
    text: m.text.substring(0, 30) + '...',
    createdAt: m.createdAt
  })));
  
  for (const msg of sorted) {
    console.log('🔎 メッセージを検査:', msg.text.substring(0, 50) + '...');
    const cands = extractSymbolsFromText(msg.text, dict);
    console.log('🎯 検出された候補:', cands);
    if (cands.length) {
      console.log('✅ 見つかった銘柄:', cands[0]);
      return cands[0]; // 先頭出現を採用
    }
  }
  console.log('❌ 銘柄が見つかりませんでした');
  return null;
}
