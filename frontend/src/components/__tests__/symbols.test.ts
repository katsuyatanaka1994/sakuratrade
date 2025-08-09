import { extractCodesFromText, extractSymbolsFromText, getLatestSymbolFromChat, SymbolItem } from '../../utils/symbols';

describe('symbols utils', () => {
  const dict: SymbolItem[] = [
    { code: '5803', name: 'フジクラ', market: 'プライム' },
    { code: '9984', name: 'ソフトバンクグループ', market: 'プライム' },
  ];

  test('extractCodesFromText', () => {
    expect(extractCodesFromText('今日は5803が強い')).toEqual(['5803']);
    expect(extractCodesFromText('9984.T について')).toEqual(['9984']);
  });

  test('extractSymbolsFromText with names', () => {
    const t = 'フジクラとソフトバンクグループが話題';
    const got = extractSymbolsFromText(t, dict).sort();
    expect(got).toEqual(['5803','9984'].sort());
  });

  test('getLatestSymbolFromChat chooses latest', () => {
    const msgs = [
      { id:'1', chatId:'a', text:'まずは5803', createdAt: 100 },
      { id:'2', chatId:'a', text:'次にソフトバンクグループ', createdAt: 200 },
    ];
    const latest = getLatestSymbolFromChat(msgs as any, dict);
    expect(latest).toBe('9984');
  });
});

