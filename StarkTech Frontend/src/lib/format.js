// Форматирование и подписи для enum'ов из Domain/Enums (сериализуются строками).

export const money = (v) =>
  v === null || v === undefined || v === ''
    ? '—'
    : `${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} смн`;

export const date = (v) =>
  v ? new Date(v).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (v) =>
  v
    ? new Date(v).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

export const ORDER_STATUS = {
  New: 'Новый',
  Confirmed: 'Подтверждён',
  InProduction: 'В производстве',
  ReadyForDelivery: 'Готов к доставке',
  Delivered: 'Доставлен',
  Cancelled: 'Отменён',
};

export const PAYMENT_METHOD = {
  Cash: 'Наличными при получении',
  AlifPay: 'Alif Pay',
  KortiMilli: 'Корти Миллӣ',
  CardTransfer: 'Перевод на карту',
};

export const PAYMENT_STATUS = {
  Pending: 'Ожидает оплаты',
  Paid: 'Оплачен',
  Failed: 'Ошибка оплаты',
  Refunded: 'Возврат',
};

export const ORDER_SOURCE = { Website: 'Сайт', InstagramManual: 'Instagram, вручную' };
export const DISCOUNT_TYPE = { Percent: 'Процент', FixedAmount: 'Сумма' };
export const COIN_TYPE = { Earned: 'Начислено', Redeemed: 'Списано', ManualAdjustment: 'Корректировка' };
export const NOTIFICATION_CHANNEL = { Telegram: 'Telegram', Email: 'Email', SMS: 'SMS' };
export const NOTIFICATION_STATUS = { Sent: 'Отправлено', Failed: 'Ошибка' };
export const ROLES = { Client: 'Клиент', Admin: 'Администратор', SuperAdmin: 'Суперадмин' };

export const ATTRIBUTE_LABELS = {
  size: 'Размер',
  shape: 'Форма',
  phoneModel: 'Модель телефона',
  quantity: 'Количество',
  color: 'Цвет',
};

const VALUE_LABELS = {
  heart: 'Сердце',
  circle: 'Круг',
  round: 'Круг',
  square: 'Квадрат',
  star: 'Звезда',
  rectangle: 'Прямоугольник',
  oval: 'Овал',
};

export const attrLabel = (k) => ATTRIBUTE_LABELS[k] || k;
export const attrValue = (v) => VALUE_LABELS[String(v).toLowerCase()] || v;

export const PERMISSION_LABELS = {
  'orders.view': 'Просмотр заказов',
  'orders.edit': 'Изменение заказов',
  'orders.manual-create': 'Создание заказов вручную',
  'products.view': 'Просмотр товаров',
  'products.edit': 'Изменение товаров',
  'products.delete': 'Удаление товаров',
  'reviews.moderate': 'Модерация отзывов',
  'portfolio.manage': 'Портфолио',
  'promo-codes.manage': 'Промокоды',
  'combo-offers.manage': 'Комбо-предложения',
  'delivery-cities.manage': 'Города доставки',
  'users.manage': 'Пользователи',
  'users.change-role': 'Смена ролей',
  'roles-permissions.manage': 'Права ролей',
  'finance.view': 'Финансы',
  'coins.manage': 'Монеты',
};

export function parseJson(s, fallback) {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/** ISO → значение для <input type="datetime-local"> */
export function toInputDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromInputDate = (v) => (v ? new Date(v).toISOString() : null);

/** Название сущности на выбранном языке с запасными вариантами. */
export const nameOf = (x, lang = 'Ru') => x?.[`name${lang}`] || x?.nameRu || x?.nameEn || x?.nameTj || '';
export const descOf = (x, lang = 'Ru') => x?.[`description${lang}`] || x?.descriptionRu || x?.descriptionEn || '';
