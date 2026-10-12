// Контакты магазина — те же, что в профиле Instagram @starktech.tj.
export const CONTACTS = {
  phone: '+992 111 22 32 67',
  phoneHref: 'tel:+992111223267',
  whatsapp: 'https://wa.me/992111223267',
  telegram: 'https://t.me/starktech.tj',
  instagram: 'https://www.instagram.com/starktech.tj/',
  instagramHandle: '@starktech.tj',
  city: 'Душанбе',
  leadTime: '1–2 дня',
};

/** Ссылка на WhatsApp с готовым текстом сообщения. */
export const whatsappWith = (text) => `${CONTACTS.whatsapp}?text=${encodeURIComponent(text)}`;
