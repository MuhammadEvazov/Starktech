import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearCartPhotos, loadCartPhotos, photoCopies, saveCartPhotos, sumCopies } from '../lib/cartPhotoStore.js';
import { lineTotal, round2 } from '../lib/pricing.js';
import { orderPhotosApi, productsApi, variantsApi } from '../api/endpoints.js';
import { useAuth } from './AuthContext.jsx';

// Корзина принадлежит вошедшему пользователю: позиции — в localStorage под ключом с его id,
// фото (File нельзя положить в localStorage) — в IndexedDB (lib/cartPhotoStore.js), тоже с его id.
// При выходе из аккаунта (или истечении входа) корзина и фото этого пользователя удаляются;
// другой пользователь того же браузера видит только свою корзину.
// pending — фото, которые не догрузились к уже оформленному заказу: их можно отправить повторно из корзины.
const LEGACY_KEY = 'st_cart';
const keyFor = (owner) => `st_cart:${owner}`;
const CartCtx = createContext(null);

// Количество задаётся у каждого фото (stCopies — сколько стикеров с него): у позиции с фото
// количество = сумма копий. Без фото (товар без печати или фото ещё не выбраны) — как задал покупатель.
const withPhotoQuantity = (item) => ({
  ...item,
  quantity: item.photos?.length ? Math.max(1, sumCopies(item.photos)) : Math.max(1, item.quantity),
});

// Фото из хранилища до появления копий: прежнее «лишнее» количество (сверх числа фото)
// отдаём первому фото, чтобы итог позиции не уменьшился.
function adoptLegacyCopies(photos, quantity) {
  if (!photos.length || photos.some((f) => f.stCopies != null)) return photos;
  const extra = Math.max(0, (Number(quantity) || 0) - photos.length);
  if (extra) photos[0].stCopies = 1 + extra;
  return photos;
}

const pendingPhotoKey = (key) => `retry:${key}`;

function loadCart(owner) {
  try {
    localStorage.removeItem(LEGACY_KEY); // старая общая корзина без владельца
  } catch { /* ignore */ }
  if (!owner) return { items: [], pending: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(owner)) || '{}');
    const items = Array.isArray(raw.items) ? raw.items.map((i) => ({ ...i, tiers: i.tiers ?? [], photos: [] })) : [];
    const pending = Array.isArray(raw.pending) ? raw.pending.map((p) => ({ ...p, photos: [] })) : [];
    return { items, pending };
  } catch {
    return { items: [], pending: [] };
  }
}

/** Цена позиции с учётом скидки за количество. */
export const itemTotal = (i) => lineTotal(i.price, i.tiers, i.quantity);

/**
 * Загрузить одно фото к позиции заказа (с кадром и макетом, если они есть).
 * → 'ok' | 'crop' (фото на сервере, но кадр/макет не сохранились) | 'fail' (само фото не загрузилось).
 * После успешной загрузки на файле остаётся stUploadedId — повтор не загрузит фото второй раз.
 */
export async function uploadCartPhoto(orderItemId, file) {
  if (!file.stUploadedId) {
    try {
      const uploaded = await orderPhotosApi.upload(orderItemId, file, photoCopies(file));
      file.stUploadedId = uploaded?.id ?? null;
      if (!file.stUploadedId) return file.stCrop && file.stPreview ? 'crop' : 'ok';
    } catch {
      return 'fail';
    }
  }
  if (!file.stCrop || !file.stPreview) return 'ok';
  try {
    await orderPhotosApi.updateCrop(file.stUploadedId, JSON.stringify(file.stCrop));
    await orderPhotosApi.uploadPreview(file.stUploadedId, file.stPreview);
    return 'ok';
  } catch {
    return 'crop';
  }
}

/**
 * Свежие цены и доступность позиций: { updates: { variantId: { dead } | { price, tiers, requiresPhoto } },
 * removed: [название], changed: [{ name, from, to }], failed } — failed: часть проверок не удалась (сеть), такие позиции не трогаем.
 */
export async function checkCartItems(items) {
  const products = {};
  const variants = {};
  let failed = false;
  // null — товара/варианта больше нет (404); undefined — проверить не удалось
  const fetchOr = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e?.status === 404) return null;
      failed = true;
      return undefined;
    }
  };
  await Promise.all([
    ...[...new Set(items.map((i) => i.productId))].map(async (id) => {
      products[id] = await fetchOr(() => productsApi.get(id));
    }),
    ...items.map(async (i) => {
      variants[i.variantId] = await fetchOr(() => variantsApi.get(i.variantId));
    }),
  ]);

  const updates = {};
  const removed = [];
  const changed = [];
  for (const i of items) {
    const p = products[i.productId];
    const v = variants[i.variantId];
    if (p === undefined || v === undefined) continue;
    const dead =
      !p || !v || !p.isActive || !v.isActive || p.deletedAt || v.deletedAt || (v.productId && v.productId !== i.productId);
    if (dead) {
      updates[i.variantId] = { dead: true };
      removed.push(i.name);
      continue;
    }
    const price = Number(v.price);
    const tiers = Array.isArray(p.quantityTiers) ? p.quantityTiers : i.tiers ?? [];
    if (round2(price) !== round2(i.price)) changed.push({ name: i.name, from: i.price, to: price });
    updates[i.variantId] = { price, tiers, requiresPhoto: !!p.requiresPhotoUpload };
  }
  return { updates, removed, changed, failed };
}

export function CartProvider({ children }) {
  const { session } = useAuth();
  const owner = session?.userId ?? null;

  const [cartOwner, setCartOwner] = useState(owner);
  const [items, setItems] = useState(() => loadCart(owner).items);
  const [pending, setPending] = useState(() => loadCart(owner).pending);
  // 'loading' — фото ещё читаются из IndexedDB; 'ready'; 'failed' — прочитать не удалось (хранилище не перезаписываем)
  const [photosState, setPhotosState] = useState(owner ? 'loading' : 'ready');
  // «Купить сейчас»: одна позиция мимо корзины (только в памяти вкладки — File не переживает history.state)
  const [buyNow, setBuyNow] = useState(null);

  // Сменился пользователь (вход, выход, истёк вход) — показываем корзину нового владельца.
  if (cartOwner !== owner) {
    const next = loadCart(owner);
    setCartOwner(owner);
    setItems(next.items);
    setPending(next.pending);
    setPhotosState(owner ? 'loading' : 'ready');
    setBuyNow(null);
  }

  // Выход из аккаунта или истечение входа — удаляем корзину и фото прежнего пользователя из браузера.
  const prevOwner = useRef(owner);
  useEffect(() => {
    const prev = prevOwner.current;
    prevOwner.current = owner;
    if (prev && prev !== owner && !owner) {
      try {
        localStorage.removeItem(keyFor(prev));
      } catch { /* ignore */ }
      clearCartPhotos(prev);
    }
  }, [owner]);

  useEffect(() => {
    if (!cartOwner) return;
    try {
      localStorage.setItem(
        keyFor(cartOwner),
        JSON.stringify({
          items: items.map(({ photos, ...rest }) => rest),
          pending: pending.map(({ photos, ...rest }) => rest),
        }),
      );
    } catch { /* ignore */ }
  }, [items, pending, cartOwner]);

  // Возвращаем фото из IndexedDB в позиции, у которых их ещё нет.
  useEffect(() => {
    if (!cartOwner) return undefined;
    let active = true;
    loadCartPhotos(cartOwner).then(
      (byKey) => {
        if (!active) return;
        setItems((list) =>
          list.map((i) =>
            !i.photos.length && byKey[i.variantId]?.length
              ? withPhotoQuantity({ ...i, photos: adoptLegacyCopies(byKey[i.variantId], i.quantity) })
              : i,
          ),
        );
        // Недогруженные фото без самих файлов повторить нельзя — такие записи убираем.
        setPending((list) =>
          list
            .map((p) => (!p.photos.length && byKey[pendingPhotoKey(p.key)]?.length ? { ...p, photos: byKey[pendingPhotoKey(p.key)] } : p))
            .filter((p) => p.photos.length),
        );
        setPhotosState('ready');
      },
      () => active && setPhotosState('failed'),
    );
    return () => {
      active = false;
    };
  }, [cartOwner]);

  // Сохраняем фото только после успешного восстановления — иначе пустая корзина на старте
  // (или неудачное чтение) стёрла бы сохранённые.
  useEffect(() => {
    if (photosState !== 'ready' || !cartOwner) return;
    saveCartPhotos(cartOwner, {
      ...Object.fromEntries(items.map((i) => [i.variantId, i.photos])),
      ...Object.fromEntries(pending.map((p) => [pendingPhotoKey(p.key), p.photos])),
    });
  }, [items, pending, photosState, cartOwner]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const add = useCallback((item) => {
    setItems((list) => {
      const existing = list.find((i) => i.variantId === item.variantId);
      if (existing) {
        return list.map((i) =>
          i.variantId === item.variantId
            ? withPhotoQuantity({
                ...i,
                price: item.price ?? i.price,
                tiers: item.tiers ?? i.tiers ?? [],
                quantity: i.quantity + item.quantity, // для позиций с фото пересчитается по копиям
                photos: [...i.photos, ...(item.photos || [])],
              })
            : i,
        );
      }
      return [...list, withPhotoQuantity({ ...item, tiers: item.tiers ?? [], photos: item.photos || [] })];
    });
  }, []);

  const setQuantity = useCallback((variantId, quantity) => {
    // У позиции с фото количество — сумма копий; меняется копиями у фото, а не здесь.
    setItems((list) =>
      list.map((i) => (i.variantId === variantId ? withPhotoQuantity({ ...i, quantity: Math.max(1, quantity) }) : i)),
    );
  }, []);

  const setPhotos = useCallback((variantId, photos) => {
    setItems((list) => list.map((i) => (i.variantId === variantId ? withPhotoQuantity({ ...i, photos }) : i)));
  }, []);

  const remove = useCallback((variantId) => {
    setItems((list) => list.filter((i) => i.variantId !== variantId));
  }, []);

  /** Убрать оформленные позиции (по variantId). */
  const removeMany = useCallback((variantIds) => {
    const ids = new Set(variantIds);
    setItems((list) => list.filter((i) => !ids.has(i.variantId)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  /** Фото, не догрузившиеся к заказу: [{ key, orderId, orderNumber, orderItemId, name, image, photos }]. */
  const addPending = useCallback((entries) => {
    if (!entries.length) return;
    setPending((list) => [...list, ...entries]);
  }, []);
  const setPendingPhotos = useCallback((key, photos) => {
    setPending((list) => (photos.length ? list.map((p) => (p.key === key ? { ...p, photos } : p)) : list.filter((p) => p.key !== key)));
  }, []);

  /** Проверить цены и доступность позиций; мёртвые позиции убираются, цены обновляются. */
  const revalidate = useCallback(async () => {
    const snapshot = itemsRef.current;
    if (!snapshot.length) return { removed: [], changed: [], failed: false };
    const res = await checkCartItems(snapshot);
    setItems((list) =>
      list.flatMap((i) => {
        const u = res.updates[i.variantId];
        if (!u) return [i];
        if (u.dead) return [];
        return [{ ...i, price: u.price, tiers: u.tiers, requiresPhoto: u.requiresPhoto }];
      }),
    );
    return res;
  }, []);

  const value = useMemo(
    () => ({
      items,
      pending,
      photosState,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: round2(items.reduce((s, i) => s + itemTotal(i), 0)),
      add,
      setQuantity,
      setPhotos,
      remove,
      removeMany,
      clear,
      addPending,
      setPendingPhotos,
      revalidate,
      buyNow,
      setBuyNow,
    }),
    [items, pending, photosState, add, setQuantity, setPhotos, remove, removeMany, clear, addPending, setPendingPhotos, revalidate, buyNow],
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);

/** Проверка корзины при открытии страницы: { checking, removed, changed, failed }. */
export function useCartCheck(enabled = true) {
  const { revalidate } = useCart();
  const [state, setState] = useState({ checking: enabled, removed: [], changed: [], failed: false });
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    revalidate().then(
      (res) => active && setState({ checking: false, removed: res.removed, changed: res.changed, failed: res.failed }),
      () => active && setState((s) => ({ ...s, checking: false, failed: true })),
    );
    return () => {
      active = false;
    };
  }, [revalidate, enabled]);
  return state;
}
