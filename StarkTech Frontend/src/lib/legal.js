// Реквизиты и общие данные для юридических страниц (/privacy, /terms, /refund) и подвала.
//
// ВЛАДЕЛЬЦУ: заполните все значения в квадратных скобках [ … ] настоящими данными
// (ФИО/наименование, ИНН, адрес, email), а сами тексты политики, оферты и правил возврата
// перед публикацией покажите юристу — они составлены как шаблон и не являются юридической консультацией.
import { CONTACTS } from './contacts.js';

export const COMPANY = {
  brand: 'StarkTech',
  legalName: 'ИП [ФИО владельца]',
  tin: '[ИНН]',
  address: 'г. Душанбе, [адрес]',
  city: CONTACTS.city,
  phone: CONTACTS.phone,
  phoneHref: CONTACTS.phoneHref,
  email: '[email для обращений]',
  telegram: CONTACTS.telegram,
  whatsapp: CONTACTS.whatsapp,
  instagram: CONTACTS.instagram,
  instagramHandle: CONTACTS.instagramHandle,
};

/** Дата текущей редакции документов (ГГГГ-ММ-ДД). */
export const LEGAL_UPDATED = '2026-10-13';

/** Дата редакции в виде «13 октября 2026 г.». */
export const legalUpdatedText = () =>
  new Date(`${LEGAL_UPDATED}T00:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** Сервисы, которым передаются данные для работы сайта. */
export const THIRD_PARTIES = [
  { name: 'Render', purpose: 'сервер API: обработка заказов, аккаунтов и чата' },
  { name: 'Vercel', purpose: 'хостинг сайта' },
  { name: 'Supabase Storage', purpose: 'хранение фото, чеков об оплате и макетов' },
  { name: 'Gmail SMTP', purpose: 'отправка писем для сброса пароля' },
];
