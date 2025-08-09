// モックデータ用
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

export async function getAdvice(file: File) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/advice`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error fetching advice:", error);
    throw error;
  }
}
