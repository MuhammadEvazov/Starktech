import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadCartPhotos, saveCartPhotos } from '../lib/cartPhotoStore.js';

// Позиции корзины хранятся в localStorage, а фото (File нельзя положить в localStorage) —
// в IndexedDB (lib/cartPhotoStore.js), поэтому они переживают перезагрузку. Загружаются после создания заказа.
const KEY = 'st_cart';
const CartCtx = createContext(null);

// Одно фото = один стикер: количество позиции не может быть меньше числа её фото
// (больше — можно, лишние экземпляры печатаются копиями).
const withPhotoQuantity = (item) => ({ ...item, quantity: Math.max(1, item.quantity, item.photos?.length ?? 0) });

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.map((i) => ({ ...i, photos: [] })) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  const [photosRestored, setPhotosRestored] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items.map(({ photos, ...rest }) => rest)));
    } catch { /* ignore */ }
  }, [items]);

  // При открытии сайта возвращаем фото из IndexedDB в позиции, у которых их ещё нет.
  useEffect(() => {
    let active = true;
    loadCartPhotos()
      .then((byVariant) => {
        if (!active) return;
        setItems((list) =>
          list.map((i) =>
            !i.photos.length && byVariant[i.variantId]?.length ? withPhotoQuantity({ ...i, photos: byVariant[i.variantId] }) : i,
          ),
        );
      })
      .finally(() => active && setPhotosRestored(true));
    return () => {
      active = false;
    };
  }, []);

  // Сохраняем фото только после восстановления — иначе пустая корзина на старте стёрла бы сохранённые.
  useEffect(() => {
    if (!photosRestored) return;
    saveCartPhotos(Object.fromEntries(items.map((i) => [i.variantId, i.photos])));
  }, [items, photosRestored]);

  const add = useCallback((item) => {
    setItems((list) => {
      const existing = list.find((i) => i.variantId === item.variantId);
      if (existing) {
        return list.map((i) =>
          i.variantId === item.variantId
            ? withPhotoQuantity({ ...i, quantity: i.quantity + item.quantity, photos: [...i.photos, ...(item.photos || [])] })
            : i,
        );
      }
      return [...list, withPhotoQuantity({ ...item, photos: item.photos || [] })];
    });
  }, []);

  const setQuantity = useCallback((variantId, quantity) => {
    setItems((list) => list.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, i.photos.length, quantity) } : i)));
  }, []);

  const setPhotos = useCallback((variantId, photos) => {
    setItems((list) => list.map((i) => (i.variantId === variantId ? withPhotoQuantity({ ...i, photos }) : i)));
  }, []);

  const remove = useCallback((variantId) => {
    setItems((list) => list.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
      add,
      setQuantity,
      setPhotos,
      remove,
      clear,
    }),
    [items, add, setQuantity, setPhotos, remove, clear],
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);
