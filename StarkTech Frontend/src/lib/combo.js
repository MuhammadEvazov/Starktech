// Комбо-предложения: скидка, если в заказе есть все товары набора.
// Расчёт повторяет OrderService.ApplyDiscount на бэкенде.
import { parseJson } from './format.js';

export const comboProductIds = (combo) => parseJson(combo?.productIdsJson, []);

/** Активно ли комбо прямо сейчас (флаг + срок действия). */
export function isComboLive(combo, now = Date.now()) {
  if (!combo?.isActive) return false;
  if (combo.validFrom && new Date(combo.validFrom) > now) return false;
  if (combo.validTo && new Date(combo.validTo) < now) return false;
  return comboProductIds(combo).length > 0;
}

export function discountFor(type, value, subtotal) {
  const v = Number(value) || 0;
  return type === 'Percent' ? (subtotal * v) / 100 : v;
}

export const discountLabel = (c) =>
  c.discountType === 'Percent' ? `−${Number(c.discountValue)}%` : `−${Number(c.discountValue)} смн`;

/** Комбо, все товары которых лежат в корзине. */
export function applicableCombos(combos, cartItems) {
  const inCart = new Set(cartItems.map((i) => i.productId));
  return (combos ?? []).filter((c) => isComboLive(c) && comboProductIds(c).every((id) => inCart.has(id)));
}

/** Самое выгодное подходящее комбо или null. Сервер принимает только одно. */
export function bestCombo(combos, cartItems, subtotal) {
  let best = null;
  let bestValue = 0;
  for (const c of applicableCombos(combos, cartItems)) {
    const value = discountFor(c.discountType, c.discountValue, subtotal);
    if (value > bestValue) {
      best = c;
      bestValue = value;
    }
  }
  return best;
}
