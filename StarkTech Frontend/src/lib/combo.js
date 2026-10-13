// Комбо-предложения: скидка, если в заказе есть все товары набора.
// Расчёт повторяет OrderService на бэкенде: процент комбо считается только от суммы товаров этого комбо,
// фиксированная скидка — как есть; результат округляется до копеек и не превышает базу.
import { parseJson } from './format.js';
import { round2 } from './pricing.js';

export const comboProductIds = (combo) => parseJson(combo?.productIdsJson, []);

/** Активно ли комбо прямо сейчас (флаг + срок действия). */
export function isComboLive(combo, now = Date.now()) {
  if (!combo?.isActive) return false;
  if (combo.validFrom && new Date(combo.validFrom) > now) return false;
  if (combo.validTo && new Date(combo.validTo) < now) return false;
  return comboProductIds(combo).length > 0;
}

/** Скидка от базы: процент или фиксированная сумма; округлена и ограничена [0; база]. */
export function discountFor(type, value, base) {
  const v = Number(value) || 0;
  const b = Math.max(0, Number(base) || 0);
  const raw = type === 'Percent' ? (b * v) / 100 : v;
  return Math.min(b, Math.max(0, round2(raw)));
}

export const discountLabel = (c) =>
  c.discountType === 'Percent' ? `−${Number(c.discountValue)}%` : `−${Number(c.discountValue)} смн`;

/** Комбо, все товары которых лежат в корзине. lines — [{ productId, total }]. */
export function applicableCombos(combos, lines) {
  const inCart = new Set(lines.map((i) => i.productId));
  return (combos ?? []).filter((c) => isComboLive(c) && comboProductIds(c).every((id) => inCart.has(id)));
}

/** Сумма товаров комбо в корзине — от неё считается процент комбо. */
export function comboBase(combo, lines) {
  const ids = new Set(comboProductIds(combo));
  return round2(lines.filter((l) => ids.has(l.productId)).reduce((s, l) => s + (Number(l.total) || 0), 0));
}

/** Скидка комбо для строк корзины: процент — только от товаров комбо; фиксированная — не больше суммы товаров. */
export function comboDiscount(combo, lines) {
  if (!combo) return 0;
  const base = combo.discountType === 'Percent' ? comboBase(combo, lines) : lines.reduce((s, l) => s + (Number(l.total) || 0), 0);
  return discountFor(combo.discountType, combo.discountValue, base);
}

/** Самое выгодное подходящее комбо или null. Сервер принимает только одно. */
export function bestCombo(combos, lines) {
  let best = null;
  let bestValue = 0;
  for (const c of applicableCombos(combos, lines)) {
    const value = comboDiscount(c, lines);
    if (value > bestValue) {
      best = c;
      bestValue = value;
    }
  }
  return best;
}
