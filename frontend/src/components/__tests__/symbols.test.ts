import { extractCodesFromText, extractSymbolsFromText, getLatestSymbolFromChat } from '../../utils/symbols';
import type { SymbolItem } from '../../utils/symbols';

describe('symbols utils', () => {
  const dict: SymbolItem[] = [
    { code: '5803', name: 'フジクラ', market: 'プライム' },
    { code: '9984', name: 'ソフトバンクグループ', market: 'プライム' },
    { code: '7203', name: 'トヨタ', market: 'プライム' },
  ];

  test.skip('extractCodesFromText (legacy - deprecated; numeric codes are ignored in new spec)', () => {
    // 旧機能のテスト（現在は使用されない）
    expect(extractCodesFromText('今日は5803が強い')).toEqual(['5803']);
    expect(extractCodesFromText('9984.T について')).toEqual(['9984']);
  });

  test('extractSymbolsFromText with names only (new spec)', () => {
    // 銘柄名ベースでの検出
    const t = 'フジクラとソフトバンクグループが話題';
    const got = extractSymbolsFromText(t, dict).sort();
    expect(got).toEqual(['5803','9984'].sort());
  });

  test('extractSymbolsFromText ignores numeric codes (new spec)', () => {
    // 4桁コードは無視される
    const t = '今日は5803が強い';
    const got = extractSymbolsFromText(t, dict);
    expect(got).toEqual([]); // コードのみでは検出されない
  });

  test('extractSymbolsFromText detects names in numeric context', () => {
    // 数値文脈でも銘柄名は検出される
    const t = 'フジクラを1000株、5000円で買いたい';
    const got = extractSymbolsFromText(t, dict);
    expect(got).toEqual(['5803']);
  });

  test('extractSymbolsFromText prevents false positives in numeric context', () => {
    // 数値文脈での誤認防止
    const t = '建値2000円、利確3000円で決済';
    const got = extractSymbolsFromText(t, dict);
    expect(got).toEqual([]); // 銘柄名がないので検出されない
  });

  test('getLatestSymbolFromChat chooses latest by name (new spec)', () => {
    const msgs = [
      { id:'1', chatId:'a', text:'まずは5803', createdAt: 100 }, // コードのみ→検出されない
      { id:'2', chatId:'a', text:'次にソフトバンクグループ', createdAt: 200 }, // 名前→検出される
    ];
    const latest = getLatestSymbolFromChat(msgs as any, dict);
    expect(latest).toBe('9984'); // ソフトバンクグループが検出される
  });

  test('getLatestSymbolFromChat with mixed name and code context', () => {
    const msgs = [
      { id:'1', chatId:'a', text:'フジクラ（5803）について', createdAt: 100 },
      { id:'2', chatId:'a', text:'トヨタの業績が良い', createdAt: 200 },
    ];
    const latest = getLatestSymbolFromChat(msgs as any, dict);
    expect(latest).toBe('7203'); // トヨタが最新
  });
});
