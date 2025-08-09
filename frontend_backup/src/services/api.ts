export async function getAdviceMock() {
  return {
    symbol: "DUMMY",
    entry_price: 1000,
    pattern_name: "下降トレンド・戻り売り型",
    score: 0.9,
    advice_html: `
      <h2>✅ 現在の状況（テスト時点）</h2>
      <p>下降トレンド継続中。戻り売りチャンスです。</p>
    `
  };
}
