// Проверки имени и телефона — те же правила, что на сервере (PersonNameAttribute, PhoneNumberFormatAttribute).

const NAME_RE = /^[\p{L}\p{M}]+(?:[ .'’-]+[\p{L}\p{M}]+)*\.?$/u;
const PHONE_RE = /^\+?[0-9 ()-]+$/;

/** Текст ошибки для имени или null. Пустое значение не проверяется (обязательность — отдельно). */
export function nameError(value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (v.length < 2 || v.length > 100 || !NAME_RE.test(v))
    return 'Имя: только буквы, пробелы, дефис и апостроф (от 2 до 100 символов).';
  return null;
}

/** Текст ошибки для телефона или null. Пустое значение не проверяется. */
export function phoneError(value) {
  const v = (value || '').trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, '').length;
  if (v.length > 30 || !PHONE_RE.test(v) || digits < 9 || digits > 15)
    return 'Телефон: укажите номер цифрами, например +992 900 12 34 56.';
  return null;
}

/** Ошибки формы в формате ErrorBox ({ messages }) или null. */
export function contactErrors(name, phone) {
  const messages = [nameError(name), phoneError(phone)].filter(Boolean);
  return messages.length ? { messages } : null;
}
