import '../../styles/site/checkout.css';
import { useState } from 'react';
import { Link } from '../../lib/router.jsx';
import { itemTotal, uploadCartPhoto, useCart, useCartCheck } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { attrLabel, attrValue, money, nameOf } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { comboOffersApi, ordersApi } from '../../api/endpoints.js';
import { bestCombo, discountLabel } from '../../lib/combo.js';
import { nextTier, percentLabel, tierPercent, unitPrice } from '../../lib/pricing.js';
import { shapeKind, SHAPE_LABEL } from '../../lib/shapes.js';
import { fileId, sumCopies } from '../../lib/cartPhotoStore.js';
import { Img } from '../../components/ui.jsx';
import PhotoPicker from '../../components/PhotoPicker.jsx';
import PhotoEditor, { printSizeCm } from '../../components/PhotoEditor.jsx';
import { Stepper, stickerWord } from './Product.jsx';

const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** Форма стикера позиции (из атрибута shape варианта) или null. */
export const itemShape = (item) => (item.attrs?.shape ? shapeKind(item.attrs.shape) : null);

/** Фото позиции, не подогнанные под форму её варианта. */
export const misfitPhotos = (item) => {
  const shape = itemShape(item);
  return shape ? item.photos.filter((f) => f.stCrop?.shape !== shape) : [];
};

/** Итог проверки корзины при открытии: какие позиции убраны и у каких изменилась цена. */
export function CartCheckNotice({ check }) {
  if (check.checking) return <p className="cart-x-note">Проверяем цены и наличие…</p>;
  return (
    <>
      {check.removed.length > 0 && (
        <p className="cart-x-note cart-x-note--warn" role="alert">
          Больше не продаются и убраны из корзины: {check.removed.join(', ')}.
        </p>
      )}
      {check.changed.length > 0 && (
        <p className="cart-x-note cart-x-note--warn" role="status">
          Изменилась цена:{' '}
          {check.changed.map((c) => `${c.name} — ${money(c.from)} → ${money(c.to)}`).join('; ')}.
        </p>
      )}
      {check.failed && (
        <p className="cart-x-note" role="status">
          Не удалось проверить актуальные цены — итог подтвердит сервер при оформлении.
        </p>
      )}
    </>
  );
}

export default function Cart() {
  const cart = useCart();
  const { isAuthenticated } = useAuth();
  const combos = useAsync(() => comboOffersApi.list({ isActive: true, pageSize: 100 }), []);
  const check = useCartCheck();
  // Подгонка фото под форму: { variantId, queue: File[] }
  const [editing, setEditing] = useState(null);

  const lines = cart.items.map((i) => ({ productId: i.productId, total: itemTotal(i) }));
  const combo = bestCombo(combos.data?.items, lines);

  const pendingBlock = cart.pending.length > 0 && <PendingPhotos />;

  if (!cart.items.length) {
    return (
      <div className="site-container cart-x-page">
        <header className="cart-x-head">
          <h1 className="site-title">Корзина</h1>
        </header>
        <CartCheckNotice check={{ ...check, changed: [], checking: false }} />
        {pendingBlock}
        <div className="site-surface cart-x-empty">
          <h2>Корзина пока пустая</h2>
          <p>Выбери стикер, брелок или чехол с твоим фото — он появится здесь.</p>
          <Link to="/catalog" className="btn btn--primary btn--large">
            Перейти в каталог
          </Link>
        </div>
      </div>
    );
  }

  const needsPhotos = cart.items.some((i) => i.requiresPhoto && !i.photos.length);
  const misfitItems = cart.items.filter((i) => misfitPhotos(i).length);
  const blocked = misfitItems.length > 0 || cart.photosState === 'loading';
  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  const countLabel = `${count} ${plural(count, 'товар', 'товара', 'товаров')}`;
  const editItem = editing && cart.items.find((i) => i.variantId === editing.variantId);

  const goButton = (cls, label) =>
    blocked ? (
      <button type="button" className={`btn btn--primary btn--large ${cls}`} disabled>
        {label}
      </button>
    ) : (
      <Link
        to={isAuthenticated ? '/checkout' : '/login'}
        state={isAuthenticated ? undefined : { from: '/checkout' }}
        className={`btn btn--primary btn--large ${cls}`}
      >
        {label}
      </Link>
    );

  return (
    <div className="site-container cart-x-page">
      <header className="cart-x-head">
        <h1 className="site-title">Корзина</h1>
        <p className="site-lead">{countLabel} на сумму {money(cart.subtotal)}</p>
      </header>

      <div className="cart-x-checks">
        <CartCheckNotice check={check} />
        {cart.photosState === 'failed' && (
          <p className="cart-x-note cart-x-note--warn" role="alert">
            Не удалось восстановить сохранённые фото из браузера. Сохранённые копии не тронуты — обнови страницу или
            добавь фото заново.
          </p>
        )}
      </div>
      {pendingBlock}

      <div className="cart-x-layout">
        <ul className="site-surface cart-x-list" aria-label="Товары в корзине">
          {cart.items.map((item) => {
            const attrs = Object.entries(item.attrs || {});
            const missing = item.requiresPhoto && !item.photos.length;
            const shape = itemShape(item);
            const misfit = misfitPhotos(item);
            const percent = tierPercent(item.tiers, item.quantity);
            const piece = unitPrice(item.price, item.tiers, item.quantity);
            const upcoming = nextTier(item.tiers, item.quantity);
            // С фото количество = сумма копий: меняется у каждого фото, а не общим степпером.
            const byPhotos = item.photos.length > 0;
            return (
              <li key={item.variantId} className="cart-x-item">
                <Img src={item.image} alt="" className="cart-x-thumb" />
                <div className="cart-x-info">
                  <div className="cart-x-top">
                    <Link to={`/product/${item.productId}`} className="cart-x-name">
                      {item.name}
                    </Link>
                    <span className="cart-x-sum cart-x-money">{money(itemTotal(item))}</span>
                  </div>
                  {attrs.length > 0 && (
                    <ul className="cart-x-attrs">
                      {attrs.map(([k, v]) => (
                        <li key={k}>
                          {attrLabel(k)}: <b>{attrValue(v)}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(item.quantity > 1 || percent > 0) && (
                    <span className="cart-x-unit cart-x-money">
                      {money(piece)} за штуку{percent > 0 && ` (скидка ${percentLabel(percent)}%)`}
                    </span>
                  )}
                  {upcoming && (
                    <span className="cart-x-tier">
                      {byPhotos ? 'Добавь ещё' : 'Возьми ещё'} {upcoming.need}{' '}
                      {byPhotos ? stickerWord(upcoming.need) : 'шт.'} — скидка {percentLabel(upcoming.discountPercent)}%
                    </span>
                  )}
                </div>

                <div className="cart-x-controls">
                  {byPhotos ? (
                    <span className="cart-x-qty" role="status">
                      <b>{item.quantity} шт.</b>
                      <small>по числу стикеров у фото</small>
                    </span>
                  ) : (
                    <Stepper value={item.quantity} onChange={(q) => cart.setQuantity(item.variantId, q)} />
                  )}
                  <button
                    type="button"
                    className="cart-x-remove"
                    onClick={() => cart.remove(item.variantId)}
                    aria-label={`Удалить «${item.name}» из корзины`}
                  >
                    Удалить
                  </button>
                </div>

                {item.requiresPhoto && (
                  <div className={`cart-x-photos ${missing || misfit.length ? 'is-missing' : ''}`}>
                    <div className="cart-x-photos__head">
                      <span className="cart-x-photos__title">Твои фото для печати</span>
                      <span className="cart-x-photos__state">
                        {missing
                          ? 'Фото пока не выбрано'
                          : `Фото: ${item.photos.length} · ${sumCopies(item.photos)} ${stickerWord(sumCopies(item.photos))}`}
                      </span>
                    </div>
                    <PhotoPicker
                      compact
                      files={item.photos}
                      onChange={(f) => cart.setPhotos(item.variantId, f)}
                      // копии меняются на самом File — пересчитываем количество и цену позиции
                      onCopiesChange={() => cart.setPhotos(item.variantId, [...item.photos])}
                      expectedShape={shape}
                      printCm={printSizeCm(item.attrs)}
                      onAdd={shape ? (added) => setEditing({ variantId: item.variantId, queue: added }) : undefined}
                      onEdit={shape ? (i) => setEditing({ variantId: item.variantId, queue: [item.photos[i]] }) : undefined}
                    />
                    {misfit.length > 0 && (
                      <p className="cart-x-tier cart-x-tier--warn">
                        Подгони фото под форму «{SHAPE_LABEL[shape]}» ({misfit.length} шт.) — без этого заказ не оформить.{' '}
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setEditing({ variantId: item.variantId, queue: misfit })}
                        >
                          Подогнать
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="site-surface cart-x-summary" aria-label="Итог">
          <h2>Итого</h2>
          <div className="cart-x-row cart-x-row--total">
            <span>Товары</span>
            <span className="cart-x-money">{money(cart.subtotal)}</span>
          </div>
          {combo && (
            <p className="cart-x-note cart-x-note--ok">
              Подходит комбо «{nameOf(combo)}»: {discountLabel(combo)} к товарам комбо. Если промокод выгоднее, применим его
              — скидки не суммируются.
            </p>
          )}
          {misfitItems.length > 0 && (
            <p className="cart-x-note cart-x-note--warn" role="alert">
              Некоторые фото не подогнаны под форму стикера. Подгони их, чтобы оформить заказ.
            </p>
          )}
          {cart.photosState === 'loading' && <p className="cart-x-note">Загружаем сохранённые фото…</p>}
          {needsPhotos && (
            <p className="cart-x-note cart-x-note--warn">
              Для некоторых товаров не выбраны фото. Их можно добавить и позже, в личном кабинете.
            </p>
          )}
          <p className="cart-x-fine">Доставка и скидка по промокоду рассчитаются при оформлении.</p>
          {goButton('btn--block cart-x-go', isAuthenticated ? 'Оформить заказ' : 'Войти и оформить заказ')}
          <Link to="/catalog" className="cart-x-more">
            Продолжить покупки
          </Link>
        </aside>
      </div>

      <div className="cart-x-bar">
        <div className="cart-x-bar__sum">
          <span className="cart-x-bar__label">{countLabel}</span>
          <span className="cart-x-bar__value cart-x-money">{money(cart.subtotal)}</span>
        </div>
        {goButton('', isAuthenticated ? 'Оформить заказ' : 'Войти и оформить')}
      </div>

      {editItem && editing.queue[0] && (
        <PhotoEditor
          key={fileId(editing.queue[0])}
          file={editing.queue[0]}
          fixedShape={itemShape(editItem)}
          printCm={printSizeCm(editItem.attrs)}
          onApply={(cropData, previewFile, copies) => {
            const f = editing.queue[0];
            f.stCrop = cropData;
            f.stPreview = previewFile;
            f.stCopies = copies;
            cart.setPhotos(editItem.variantId, [...editItem.photos]);
          }}
          onClose={() => setEditing((e) => (e && e.queue.length > 1 ? { ...e, queue: e.queue.slice(1) } : null))}
        />
      )}
    </div>
  );
}

/** Фото, которые не догрузились к оформленным заказам: повторить загрузку или убрать. */
function PendingPhotos() {
  const cart = useCart();
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState({});

  const retry = async (p) => {
    setBusy(p.key);
    let orderItemId = p.orderItemId;
    // Позицию заказа при оформлении узнать не удалось — ищем её сейчас.
    if (!orderItemId) {
      try {
        const order = await ordersApi.mineGet(p.orderId);
        orderItemId = order.items?.find((oi) => oi.productVariantId === p.variantId)?.id ?? null;
      } catch {
        /* попробуем в следующий раз */
      }
    }
    const left = [];
    for (const f of p.photos) {
      // eslint-disable-next-line no-await-in-loop
      const r = orderItemId || f.stUploadedId ? await uploadCartPhoto(orderItemId, f) : 'fail';
      if (r !== 'ok') left.push(f);
    }
    cart.setPendingPhotos(p.key, left);
    setResult((m) => ({ ...m, [p.key]: left.length }));
    setBusy(null);
  };

  return (
    <section className="site-surface cart-x-pending" aria-labelledby="cart-x-pending-title">
      <h2 id="cart-x-pending-title">Фото не догрузились к заказам</h2>
      <ul>
        {cart.pending.map((p) => (
          <li key={p.key}>
            <span className="cart-x-pending__text">
              {p.name} — заказ{' '}
              <Link to={`/account/orders/${p.orderId}`} className="text-link">
                {p.orderNumber}
              </Link>
              : фото {p.photos.length} ({sumCopies(p.photos)} {stickerWord(sumCopies(p.photos))})
              {p.photos.some((f) => f.stUploadedId) && ' (часть уже загружена, не сохранился кадр)'}
              {result[p.key] > 0 && ' — снова не получилось, попробуй позже'}
            </span>
            <span className="cart-x-pending__actions">
              <button type="button" className="btn btn--primary" disabled={busy === p.key} onClick={() => retry(p)}>
                {busy === p.key ? 'Загружаем…' : 'Загрузить ещё раз'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy === p.key}
                onClick={() => cart.setPendingPhotos(p.key, [])}
              >
                Убрать
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
