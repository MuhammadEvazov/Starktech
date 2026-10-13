// Скидки за количество (product.quantityTiers: [{ minQuantity, discountPercent }]) и округление денег.
// Повторяет Domain.Common.QuantityTiers на бэкенде: цена за штуку = цена варианта × (1 − процент лучшей ступени),
// округление до 2 знаков «от нуля» (Math.Round(x, 2, MidpointRounding.AwayFromZero)).

/** Округление до копеек «от нуля», как decimal на сервере (toPrecision убирает хвосты двоичной арифметики: 1.005 → 1.01). */
export function round2(x) {
  const n = Number(x) || 0;
  const scaled = Number((Math.abs(n) * 100).toPrecision(12));
  return (Math.sign(n) * Math.round(scaled)) / 100;
}

/** Корректные ступени, по возрастанию количества (как QuantityTiers.Parse). */
export function normalizeTiers(tiers) {
  return (Array.isArray(tiers) ? tiers : [])
    .map((t) => ({ minQuantity: Number(t?.minQuantity) || 0, discountPercent: Number(t?.discountPercent) || 0 }))
    .filter((t) => t.minQuantity >= 2 && t.discountPercent > 0 && t.discountPercent < 100)
    .sort((a, b) => a.minQuantity - b.minQuantity);
}

/** Процент скидки для количества (0 — подходящей ступени нет). */
export function tierPercent(tiers, qty) {
  return normalizeTiers(tiers)
    .filter((t) => qty >= t.minQuantity)
    .reduce((max, t) => Math.max(max, t.discountPercent), 0);
}

/** Цена за штуку с учётом ступени. */
export function unitPrice(price, tiers, qty) {
  const p = Number(price) || 0;
  const percent = tierPercent(tiers, qty);
  return percent <= 0 ? p : round2((p * (100 - percent)) / 100);
}

/** Сумма позиции: цена за штуку × количество. */
export const lineTotal = (price, tiers, qty) => round2(unitPrice(price, tiers, qty) * qty);

/** Следующая ступень, которая даст скидку больше нынешней: { minQuantity, discountPercent, need } или null. */
export function nextTier(tiers, qty) {
  const current = tierPercent(tiers, qty);
  const next = normalizeTiers(tiers).find((t) => t.minQuantity > qty && t.discountPercent > current);
  return next ? { ...next, need: next.minQuantity - qty } : null;
}

/** Подпись процента: 10 → «10», 7.5 → «7,5». */
export const percentLabel = (v) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
