export function validateSettle(priceInput: string, qtyInput: string, maxQty: number) {
  const price = Number(priceInput);
  const qty = Number(qtyInput);
  if (!Number.isFinite(price) || price <= 0) return { ok: false as const, error: '価格は0より大きい数値で入力してください' };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false as const, error: '数量は1以上の整数で入力してください' };
  if (qty > maxQty) return { ok: false as const, error: `数量が保有数を超えています（保有: ${maxQty}株）` };
  return { ok: true as const, price, qty };
}

export function formatLSHeader(long: number, short: number) {
  if (long > 0 && short > 0) return `L:${long} / S:${short}`;
  if (long > 0) return `L:${long}`;
  if (short > 0) return `S:${short}`;
  return 'L:0 / S:0';
}