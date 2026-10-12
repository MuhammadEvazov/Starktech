import '../../styles/site/checkout.css';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { citiesApi, comboOffersApi, orderPhotosApi, ordersApi, profileApi, promoCodesApi } from '../../api/endpoints.js';
import { money, nameOf, PAYMENT_METHOD } from '../../lib/format.js';
import { bestCombo, discountFor, discountLabel } from '../../lib/combo.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorBox, Input, Select, Textarea } from '../../components/ui.jsx';

// Короткие пояснения под способами оплаты.
const PAYMENT_HINT = {
  Cash: 'Курьеру или при самовывозе',
};

export default function Checkout() {
  const cart = useCart();
  const { isAuthenticated, profile, session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const cities = useAsync(() => citiesApi.list({ isActive: true, pageSize: 100 }), []);
  const combos = useAsync(() => comboOffersApi.list({ isActive: true, pageSize: 100 }), []);

  const [form, setForm] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    deliveryCityId: '',
    deliveryAddress: '',
    paymentMethod: 'Cash',
  });
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [coinsInput, setCoinsInput] = useState('');
  const [error, setError] = useState(null);
  const [stage, setStage] = useState('');

  useEffect(() => {
    if (profile || session) {
      setForm((f) => ({
        ...f,
        contactName: f.contactName || profile?.fullName || '',
        contactEmail: f.contactEmail || profile?.email || session?.email || '',
      }));
    }
  }, [profile, session]);

  // Телефон, город и адрес из профиля подставляем один раз, когда загружены и профиль, и города
  // (город из профиля берём, только если он ещё есть среди активных).
  const deliveryFilled = useRef(false);
  useEffect(() => {
    if (deliveryFilled.current || !profile || !cities.data) return;
    deliveryFilled.current = true;
    const cityOk = cities.data.items?.some((c) => c.id === profile.deliveryCityId);
    setForm((f) => ({
      ...f,
      contactPhone: f.contactPhone || profile.phoneNumber || '',
      deliveryCityId: f.deliveryCityId || (cityOk ? profile.deliveryCityId : ''),
      deliveryAddress: f.deliveryAddress || profile.deliveryAddress || '',
    }));
  }, [profile, cities.data]);

  // «Запомнить для следующих заказов» — предлагаем, только если данные отличаются от профиля.
  const [remember, setRemember] = useState(true);
  const differsFromProfile =
    !!profile &&
    (form.contactPhone.trim() !== (profile.phoneNumber || '') ||
      (form.deliveryCityId || null) !== (profile.deliveryCityId || null) ||
      form.deliveryAddress.trim() !== (profile.deliveryAddress || ''));

  // Ошибку сервера показываем рядом с кнопкой — на телефоне прокручиваем к ней.
  const errorRef = useRef(null);
  useEffect(() => {
    if (!error) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    errorRef.current?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
  }, [error]);

  if (!cart.items.length && !stage) return <Navigate to="/cart" />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const city = cities.data?.items?.find((c) => c.id === form.deliveryCityId);
  const delivery = city ? Number(city.deliveryCost) : 0;
  // Скидки считаются так же, как в OrderService: промокод + комбо от суммы товаров, не больше самой суммы.
  const promoDiscount = promo ? discountFor(promo.discountType, promo.discountValue, cart.subtotal) : 0;
  const combo = bestCombo(combos.data?.items, cart.items, cart.subtotal);
  const comboDiscount = combo ? discountFor(combo.discountType, combo.discountValue, cart.subtotal) : 0;
  const discount = Math.min(cart.subtotal, promoDiscount + comboDiscount);

  // 1 монета = 1 сомони; списать можно не больше остатка после скидок.
  const coinsBalance = isAuthenticated ? profile?.coinsBalance ?? 0 : 0;
  const maxCoins = Math.max(0, Math.min(coinsBalance, Math.floor(cart.subtotal - discount)));
  const coinsUsed = Math.min(maxCoins, Math.max(0, Math.floor(Number(coinsInput) || 0)));

  const total = Math.max(0, cart.subtotal - discount - coinsUsed) + delivery;

  // Промокод ищется через публичный GET /api/promo-codes?code=...
  const applyPromo = async () => {
    setPromoError('');
    const code = promoInput.trim();
    if (!code) return;
    try {
      const res = await promoCodesApi.list({ code, isActive: true, pageSize: 10 });
      const found = res.items.find((p) => p.code.toLowerCase() === code.toLowerCase());
      const now = Date.now();
      if (!found) return setPromoError('Такого промокода нет или он выключен.');
      if (found.validFrom && new Date(found.validFrom) > now) return setPromoError('Промокод ещё не начал действовать.');
      if (found.validTo && new Date(found.validTo) < now) return setPromoError('Срок действия промокода истёк.');
      if (found.maxUsages && found.usedCount >= found.maxUsages) return setPromoError('Промокод уже использован максимальное число раз.');
      setPromo(found);
    } catch (e) {
      setPromoError(e.messages?.[0] || 'Не удалось проверить промокод.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setStage('order');
    try {
      const created = await ordersApi.create({
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim() || null,
        deliveryCityId: form.deliveryCityId || null,
        deliveryAddress: form.deliveryAddress.trim() || null,
        paymentMethod: form.paymentMethod,
        source: 'Website',
        promoCodeId: promo?.id ?? null,
        comboOfferId: combo?.id ?? null,
        coinsUsed,
        items: cart.items.map((i) => ({ productVariantId: i.variantId, quantity: i.quantity })),
      });

      // Фото загружаются только для авторизованных — эндпоинт требует токен.
      let photoFailures = 0;
      const withPhotos = cart.items.filter((i) => i.photos.length);
      if (isAuthenticated && withPhotos.length) {
        setStage('photos');
        try {
          const order = await ordersApi.mineGet(created.id);
          for (const item of withPhotos) {
            const orderItem = order.items.find((oi) => oi.productVariantId === item.variantId);
            if (!orderItem) continue;
            for (const file of item.photos) {
              try {
                const uploaded = await orderPhotosApi.upload(orderItem.id, file);
                // Фото подогнали под форму ещё на странице товара — отправляем кадр и макет.
                if (file.stCrop && file.stPreview && uploaded?.id) {
                  await orderPhotosApi.updateCrop(uploaded.id, JSON.stringify(file.stCrop));
                  await orderPhotosApi.uploadPreview(uploaded.id, file.stPreview);
                }
              } catch {
                photoFailures++;
              }
            }
          }
        } catch {
          photoFailures = withPhotos.reduce((s, i) => s + i.photos.length, 0);
        }
      }

      // Без входа фото загрузить нельзя (эндпоинт требует токен) — сообщаем об этом на странице заказа.
      const guestPhotos = isAuthenticated ? 0 : withPhotos.reduce((s, i) => s + i.photos.length, 0);

      // Сохраняем контакты в профиль — в следующий раз подставятся сами. Ошибка здесь заказ не ломает.
      if (remember && differsFromProfile) {
        try {
          await profileApi.update({
            fullName: profile.fullName || '',
            bio: profile.bio ?? null,
            avatarUrl: profile.avatarUrl ?? null,
            phoneNumber: form.contactPhone.trim() || null,
            deliveryCityId: form.deliveryCityId || null,
            deliveryAddress: form.deliveryAddress.trim() || null,
          });
        } catch { /* не критично */ }
      }

      if (coinsUsed > 0 || (remember && differsFromProfile)) refreshProfile();
      cart.clear();
      navigate(`/order/${created.orderNumber}`, { replace: true, state: { order: created, photoFailures, guestPhotos } });
    } catch (err) {
      setError(err);
      setStage('');
    }
  };

  const busyLabel = stage === 'photos' ? 'Загружаем фото…' : stage === 'order' ? 'Оформляем…' : null;

  return (
    <div className="site-container chk-page">
      <header className="chk-head">
        <Link to="/cart" className="chk-back">
          Назад в корзину
        </Link>
        <h1 className="site-title">Оформление заказа</h1>
        <p className="site-lead">Три коротких шага. После заказа менеджер позвонит и подтвердит детали.</p>
      </header>

      <form className="chk-layout" onSubmit={submit}>
        <div className="chk-main">
          <section className="site-surface chk-section" aria-labelledby="chk-contacts">
            <div className="chk-section__head">
              <span className="chk-step" aria-hidden="true">1</span>
              <h2 id="chk-contacts">Контакты</h2>
            </div>
            <div className="chk-fields chk-fields--two">
              <Input label="Имя" required value={form.contactName} onChange={set('contactName')} autoComplete="name" />
              <Input
                label="Телефон"
                required
                type="tel"
                inputMode="tel"
                placeholder="+992 90 000 00 00"
                hint="Позвоним, чтобы подтвердить заказ"
                value={form.contactPhone}
                onChange={set('contactPhone')}
                autoComplete="tel"
              />
              <Input
                label="Email"
                type="email"
                hint="Необязательно"
                value={form.contactEmail}
                onChange={set('contactEmail')}
                autoComplete="email"
                className="chk-wide"
              />
            </div>
            {!isAuthenticated && (
              <p className="chk-login">
                Есть аккаунт?{' '}
                <Link to="/login" state={{ from: '/checkout' }} className="text-link">
                  Войдите
                </Link>
                , чтобы видеть заказ в кабинете и загрузить фото.
              </p>
            )}
            {!isAuthenticated && cart.items.some((i) => i.photos.length) && (
              <p className="done-note" role="status">
                Без входа фото не загрузятся вместе с заказом. После оформления отправьте их нам в WhatsApp с номером
                заказа — или войдите, и они прикрепятся сами.
              </p>
            )}
          </section>

          <section className="site-surface chk-section" aria-labelledby="chk-delivery">
            <div className="chk-section__head">
              <span className="chk-step" aria-hidden="true">2</span>
              <h2 id="chk-delivery">Доставка</h2>
            </div>
            <div className="chk-fields">
              <Select
                label="Город"
                placeholder="Самовывоз"
                hint={cities.loading && !cities.data ? 'Загружаем города…' : undefined}
                value={form.deliveryCityId}
                onChange={set('deliveryCityId')}
                options={(cities.data?.items ?? []).map((c) => ({
                  value: c.id,
                  label: `${nameOf(c)}, ${Number(c.deliveryCost) === 0 ? 'бесплатно' : money(c.deliveryCost)}`,
                }))}
              />
              <Textarea
                label="Адрес"
                placeholder="Улица, дом, квартира"
                hint={city ? undefined : 'Для самовывоза можно не заполнять'}
                value={form.deliveryAddress}
                onChange={set('deliveryAddress')}
                autoComplete="street-address"
              />
            </div>
            {differsFromProfile && (
              <label className="chk-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>
                  Запомнить телефон и адрес для следующих заказов
                  <small>Сохранятся в профиле — их можно изменить в личном кабинете</small>
                </span>
              </label>
            )}
          </section>

          <section className="site-surface chk-section" aria-labelledby="chk-payment">
            <div className="chk-section__head">
              <span className="chk-step" aria-hidden="true">3</span>
              <h2 id="chk-payment">Оплата</h2>
            </div>
            <div className="chk-pay" role="radiogroup" aria-labelledby="chk-payment">
              {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                <label key={value} className={`chk-pay__option ${form.paymentMethod === value ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value={value}
                    checked={form.paymentMethod === value}
                    onChange={set('paymentMethod')}
                  />
                  <span className="chk-pay__dot" aria-hidden="true" />
                  <span className="chk-pay__title">{label}</span>
                  <span className="chk-pay__desc">{PAYMENT_HINT[value] ?? 'Как оплатить, подскажет менеджер'}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="site-surface chk-summary" aria-labelledby="chk-summary-title">
          <h2 id="chk-summary-title">Ваш заказ</h2>
          <ul className="chk-items">
            {cart.items.map((i) => (
              <li key={i.variantId}>
                <span className="chk-items__name">
                  <span>{i.name}</span>
                  <span className="chk-items__qty">
                    {i.quantity} шт.
                    {i.photos.length > 0 && <span className="chk-items__photos"> · фото: {i.photos.length}</span>}
                  </span>
                </span>
                <span className="chk-money">{money(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="chk-extra">
            <div className={`chk-inline ${promoError ? 'chk-inline--error' : ''}`}>
              <label className="chk-inline__label" htmlFor="promo-input">
                Промокод
              </label>
              <div className="chk-inline__row">
                <input
                  id="promo-input"
                  className="input chk-promo-input"
                  placeholder="Если есть"
                  autoComplete="off"
                  aria-invalid={!!promoError}
                  aria-describedby={promoError ? 'promo-error' : undefined}
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !promo) {
                      e.preventDefault();
                      applyPromo();
                    }
                  }}
                  disabled={!!promo}
                />
                {promo ? (
                  <button type="button" className="btn btn--ghost" onClick={() => { setPromo(null); setPromoInput(''); }}>
                    Убрать
                  </button>
                ) : (
                  <button type="button" className="btn btn--ghost" onClick={applyPromo}>
                    Применить
                  </button>
                )}
              </div>
              {promoError && (
                <p className="field__error" id="promo-error" role="alert">
                  {promoError}
                </p>
              )}
              {promo && <p className="chk-applied">Промокод {promo.code} применён</p>}
            </div>

            {coinsBalance > 0 && (
              <div className="chk-inline">
                <label className="chk-inline__label" htmlFor="coins-input">
                  Оплатить монетами <span>на счету {coinsBalance}</span>
                </label>
                <div className="chk-inline__row">
                  <input
                    id="coins-input"
                    className="input chk-money"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={maxCoins}
                    step={1}
                    placeholder="0"
                    aria-describedby="coins-hint"
                    value={coinsInput}
                    onChange={(e) => setCoinsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault(); // случайный Enter не оформляет заказ
                  }}
                  />
                  <button type="button" className="btn btn--ghost" onClick={() => setCoinsInput(String(maxCoins))} disabled={!maxCoins}>
                    Все {maxCoins}
                  </button>
                </div>
                <p className="field__hint" id="coins-hint">
                  1 монета = 1 сомони.
                </p>
              </div>
            )}
          </div>

          <div className="chk-rows">
            <div className="chk-row">
              <span>Товары</span>
              <span className="chk-money">{money(cart.subtotal)}</span>
            </div>
            {promo && (
              <div className="chk-row chk-row--discount">
                <span>Скидка {promo.code}</span>
                <span className="chk-money">−{money(promoDiscount)}</span>
              </div>
            )}
            {combo && (
              <div className="chk-row chk-row--discount">
                <span>Комбо «{nameOf(combo)}» {discountLabel(combo)}</span>
                <span className="chk-money">−{money(comboDiscount)}</span>
              </div>
            )}
            {coinsUsed > 0 && (
              <div className="chk-row chk-row--discount">
                <span>Монетами</span>
                <span className="chk-money">−{money(coinsUsed)}</span>
              </div>
            )}
            <div className="chk-row">
              <span>Доставка</span>
              <span className="chk-money">{city ? (delivery === 0 ? 'бесплатно' : money(delivery)) : 'самовывоз'}</span>
            </div>
            <div className="chk-row chk-row--total">
              <span>Итого</span>
              <span className="chk-total chk-money">{money(total)}</span>
            </div>
          </div>
          <p className="chk-fine">Окончательную сумму рассчитает сервер при создании заказа.</p>

          <div ref={errorRef}>
            <ErrorBox error={error} />
          </div>
          <button className="btn btn--primary btn--large btn--block chk-go" disabled={!!busyLabel}>
            {busyLabel || 'Подтвердить заказ'}
          </button>
        </aside>

        <div className="chk-bar">
          <div className="chk-bar__sum">
            <span className="chk-bar__label">Итого</span>
            <span className="chk-bar__value chk-money">{money(total)}</span>
          </div>
          <button className="btn btn--primary btn--large" disabled={!!busyLabel}>
            {busyLabel || 'Подтвердить заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}
