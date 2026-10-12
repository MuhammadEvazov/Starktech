// Фото из корзины в IndexedDB браузера: File нельзя положить в localStorage, а здесь — можно.
// Так выбранные фото (и подогнанные кадры) переживают перезагрузку и закрытие вкладки.
// Любая ошибка (приватный режим, нет места) не ломает корзину — фото просто не восстановятся.

const DB_NAME = 'starktech-cart';
const STORE = 'photos';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Сохранить фото всех позиций: { variantId: File[] } (полностью заменяет прошлое содержимое). */
export async function saveCartPhotos(byVariant) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear();
      Object.entries(byVariant).forEach(([variantId, files]) => {
        if (!files?.length) return;
        // Свойства stCrop/stPreview на File не клонируются — храним их рядом с файлом.
        store.put(
          files.map((f) => ({ file: f, crop: f.stCrop ?? null, preview: f.stPreview ?? null })),
          variantId,
        );
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* хранилище недоступно — фото останутся только в памяти вкладки */
  }
}

/** Прочитать сохранённые фото: { variantId: File[] } с восстановленными stCrop/stPreview. */
export async function loadCartPhotos() {
  try {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const out = {};
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        out[cursor.key] = (cursor.value || []).map(({ file, crop, preview }) => {
          if (crop) file.stCrop = crop;
          if (preview) file.stPreview = preview;
          return file;
        });
        cursor.continue();
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return result;
  } catch {
    return {};
  }
}
