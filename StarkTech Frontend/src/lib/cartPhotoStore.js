// Фото из корзины в IndexedDB браузера: File нельзя положить в localStorage, а здесь — можно.
// Так выбранные фото (и подогнанные кадры) переживают перезагрузку и закрытие вкладки.
// Записи разделены по владельцу корзины (id пользователя): ключ «<userId>|<ключ позиции>» —
// другой пользователь этого браузера чужих фото не увидит.
// Ошибка записи (приватный режим, нет места) не ломает корзину — фото просто останутся в памяти вкладки.
// Ошибка ЧТЕНИЯ пробрасывается: корзина тогда не перезаписывает хранилище, чтобы не стереть сохранённое.

const DB_NAME = 'starktech-cart';
const STORE = 'photos';
const VERSION = 2; // v2: ключи с владельцем; старые общие записи (v1) удаляются при обновлении

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      else if (e.oldVersion < 2) req.transaction.objectStore(STORE).clear(); // общая корзина без владельца
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Операции выполняются строго по очереди: иначе очистка при выходе могла бы обогнать запоздавшую запись.
let queue = Promise.resolve();
const enqueue = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

const range = (owner) => IDBKeyRange.bound(`${owner}|`, `${owner}|￿`);

function tx(db, mode, body) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = body(t.objectStore(STORE));
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Сохранить фото владельца: { ключПозиции: File[] } (полностью заменяет его прошлые записи). */
export function saveCartPhotos(owner, byKey) {
  if (!owner) return Promise.resolve();
  return enqueue(async () => {
    try {
      const db = await openDb();
      await tx(db, 'readwrite', (store) => {
        store.delete(range(owner));
        Object.entries(byKey).forEach(([key, files]) => {
          if (!files?.length) return;
          // Свойства stCrop/stPreview/stUploadedId/stCopies на File не клонируются — храним их рядом с файлом.
          store.put(
            files.map((f) => ({
              file: f,
              copies: photoCopies(f),
              crop: f.stCrop ?? null,
              preview: f.stPreview ?? null,
              uploadedId: f.stUploadedId ?? null,
            })),
            `${owner}|${key}`,
          );
        });
      });
      db.close();
    } catch {
      /* хранилище недоступно — фото останутся только в памяти вкладки */
    }
  });
}

/** Прочитать фото владельца: { ключПозиции: File[] } с восстановленными stCrop/stPreview/stUploadedId/stCopies. Ошибку пробрасывает. */
export function loadCartPhotos(owner) {
  if (!owner) return Promise.resolve({});
  return enqueue(async () => {
    const db = await openDb();
    const prefix = `${owner}|`;
    const result = await new Promise((resolve, reject) => {
      const out = {};
      const t = db.transaction(STORE, 'readonly');
      const req = t.objectStore(STORE).openCursor(range(owner));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        out[String(cursor.key).slice(prefix.length)] = (cursor.value || []).map(({ file, copies, crop, preview, uploadedId }) => {
          // у записей до появления копий copies нет — stCopies не ставим (корзина разложит старое количество)
          if (copies) file.stCopies = copies;
          if (crop) file.stCrop = crop;
          if (preview) file.stPreview = preview;
          if (uploadedId) file.stUploadedId = uploadedId;
          return file;
        });
        cursor.continue();
      };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
    db.close();
    return result;
  });
}

/** Удалить все фото владельца (выход из аккаунта). */
export function clearCartPhotos(owner) {
  if (!owner) return Promise.resolve();
  return enqueue(async () => {
    try {
      const db = await openDb();
      await tx(db, 'readwrite', (store) => store.delete(range(owner)));
      db.close();
    } catch {
      /* нечего чистить или хранилище недоступно */
    }
  });
}

// Стабильный id для каждого File (ключи React, очередь подгонки): имя и дата изменения у разных файлов
// могут совпасть, а сам объект File — уникален.
const fileIds = new WeakMap();
let nextFileId = 0;
export function fileId(file) {
  if (!file || typeof file !== 'object') return String(file);
  let id = fileIds.get(file);
  if (!id) {
    id = `f${++nextFileId}`;
    fileIds.set(file, id);
  }
  return id;
}

// ─── Копии: сколько стикеров сделать с одного фото ───
// У файла в браузере — свойство stCopies, у фото с сервера — поле copies (по умолчанию 1).
// Количество позиции с фото = сумма копий всех её фото.
export const MAX_COPIES = 999;

/** Сколько стикеров с этого фото (File со stCopies или фото с сервера с copies), не меньше 1. */
export function photoCopies(photo) {
  const n = Math.floor(Number(photo?.stCopies ?? photo?.copies ?? 1));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_COPIES) : 1;
}

/** Сумма копий по списку фото. */
export const sumCopies = (photos) => (photos || []).reduce((s, p) => s + photoCopies(p), 0);
