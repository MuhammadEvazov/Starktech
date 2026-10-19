import '../../styles/site/checkout.css';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { citiesApi, comboOffersApi, ordersApi, paymentsApi, profileApi, promoCheckApi } from '../../api/endpoints.js';
import { money, nameOf, PAYMENT_METHOD } from '../../lib/format.js';
import { bestCombo, comboDiscount, discountFor, discountLabel } from '../../lib/combo.js';
import { percentLabel, round2, tierPercent } from '../../lib/pricing.js';
import { itemTotal, uploadCartPhoto, useCart, useCartCheck } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorBox, Input, Select, Textarea } from '../../components/ui.jsx';
import { CartCheckNotice, misfitPhotos } from './Cart.jsx';
import { contactErrors } from '../../lib/validate.js';

// Короткие пояснения под способами оплаты.
const PAYMENT_HINT = {
  Cash: 'Курьеру или при самовывозе',
  KortiMilli: 'Реквизиты и загрузка чека — сразу после оформления',
  AlifPay: 'Реквизиты и загрузка чека — сразу после оформления',
  CardTransfer: 'Реквизиты и загрузка чека — сразу после оформления',
};

/** Способ включён в настройках магазина (админка → «Оплата») и у него заполнены реквизиты. */
const methodEnabled = (s, m) =>
  m === 'Cash'
    ? s.cashEnabled
    : m === 'KortiMilli'
      ? s.kortiMilliEnabled && !!s.kortiMilliCard
      : m === 'AlifPay'
        ? s.alifPayEnabled && !!s.alifPayPhone
        : m === 'CardTransfer'
          ? s.cardTransferEnabled && !!s.cardTransferNumber
          : true;

/** Что пошло не так после создания заказа — сохраняем, чтобы страница заказа показала это и после перезагрузки. */
export const orderIssuesKey = (number) => `st_order_issues:${number}`;

export default function Checkout() {
  const cart = useCart();
  const { state: navState } = useLocation();
  // «Купить сейчас»: одна позиция мимо корзины. После перезагрузки вкладки её уже нет — вернём на товар.
  const buyNowRequested = !!navState?.buyNow;
  const buyNowItem = buyNowRequested ? cart.buyNow : null;
  // «Купить сейчас» передаёт одну позицию или несколько (фото разной формы — разные варианты)
  const items = buyNowItem ? [].concat(buyNowItem) : cart.items;

  const { profile, session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const check = useCartCheck(!buyNowRequested);
  const cities = useAsync(() => citiesApi.list({ isActive: true, pageSize: 100 }), []);
  const combos = useAsync(() => comboOffersApi.list({ isActive: true, pageSize: 100 }), []);
  const paySettings = useAsync(() => paymentsApi.settings(), []);

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
  const [promoBusy, setPromoBusy] = useState(false);
  const [coinsInput, setCoinsInput] = useState('');
  const [error, setError] = useState(null);
  const [stage, setStage] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (profile || session) {
      setForm((f) => ({
        ...f,
        contactName: f.contactName || profile?.fullName || '',
        contactEmail: f.contactEmail || profile?.email || session?.email || '',
      }));
    }
  }, [profile, session]);

  // Телефон и адрес из профиля подставляем сразу, как пришёл профиль (города для этого не нужны).
  const contactsFilled = useRef(false);
  useEffect(() => {
    if (contactsFilled.current || !profile) return;
    contactsFilled.current = true;
    setForm((f) => ({
      ...f,
      contactPhone: f.contactPhone || profile.phoneNumber || '',
      deliveryAddress: f.deliveryAddress || profile.deliveryAddress || '',
    }));
  }, [profile]);

  // Город из профиля — когда загружены и профиль, и города (только если он ещё среди активных).
  const cityFilled = useRef(false);
  useEffect(() => {
    if (cityFilled.current || !profile || !cities.data) return;
    cityFilled.current = true;
    const cityOk = cities.data.items?.some((c) => c.id === profile.deliveryCityId);
    if (cityOk) setForm((f) => ({ ...f, deliveryCityId: f.deliveryCityId || profile.deliveryCityId }));
  }, [profile, cities.data]);

  // Способ получения: доставка или самовывоз. Если активных городов нет — доступен только самовывоз.
  // Города не загрузились — в режиме доставки показываем ошибку с повтором; самовывоз работает.
  const [mode, setMode] = useState('delivery');
  const noCities = !!cities.data && !cities.data.items?.length;
  const pickup = noCities || mode === 'pickup';

  // «Запомнить для следующих заказов» — предлагаем, только если данные отличаются от профиля.
  // При самовывозе город и адрес профиля не трогаем — сравниваем и сохраняем только телефон.
  const [remember, setRemember] = useState(true);
  const differsFromProfile =
    !!profile &&
    (form.contactPhone.trim() !== (profile.phoneNumber || '') ||
      (!pickup &&
        ((form.deliveryCityId || null) !== (profile.deliveryCityId || null) ||
          form.deliveryAddress.trim() !== (profile.deliveryAddress || ''))));

  // Способ оплаты выключен в настройках магазина — выбираем первый доступный.
  useEffect(() => {
    const s = paySettings.data;
    if (!s || methodEnabled(s, form.paymentMethod)) return;
    const first = Object.keys(PAYMENT_METHOD).find((m) => methodEnabled(s, m));
    if (first) setForm((f) => ({ ...f, paymentMethod: first }));
  }, [paySettings.data, form.paymentMethod]);

  // Ошибку сервера показываем рядом с кнопкой — на телефоне прокручиваем к ней.
  const errorRef = useRef(null);
  useEffect(() => {
    if (!error) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    errorRef.current?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
  }, [error]);

  if (buyNowRequested && !buyNowItem && !stage) {
    return <Navigate to={navState?.productId ? `/product/${navState.productId}` : '/cart'} />;
  }
  if (!items.length && !stage && !check.checking) return <Navigate to="/cart" />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const city = pickup ? null : cities.data?.items?.find((c) => c.id === form.deliveryCityId);
  const delivery = city ? Number(city.deliveryCost) : 0;

  // Суммы как в OrderService: цены со скидкой за количество; промокод и комбо НЕ суммируются —
  // применяется более выгодная скидка (процент комбо — только от товаров комбо).
  const lines = items.map((i) => ({ productId: i.productId, total: itemTotal(i) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const promoDiscount = promo ? discountFor(promo.discountType, promo.discountValue, subtotal) : 0;
  const combo = bestCombo(combos.data?.items, lines);
  const comboValue = comboDiscount(combo, lines);
  const usePromo = !!promo && promoDiscount >= comboValue;
  const useCombo = !!combo && !usePromo && comboValue > 0;
  const discount = Math.min(subtotal, usePromo ? promoDiscount : useCombo ? comboValue : 0);
  const bothApply = !!promo && !!combo && comboValue > 0;

  // 1 монета = 1 сомони; списать можно не больше остатка после скидок.
  const coinsBalance = profile?.coinsBalance ?? 0;
  const maxCoins = Math.max(0, Math.min(coinsBalance, Math.floor(subtotal - discount)));
  const coinsUsed = Math.min(maxCoins, Math.max(0, Math.floor(Number(coinsInput) || 0)));
  // Ввели больше, чем можно списать, — предупреждаем; при уходе из поля подставляем максимум.
  const coinsOver = Number(coinsInput) > maxCoins;

  const total = round2(Math.max(0, subtotal - discount - coinsUsed) + delivery);
  const nothingToPay = total <= 0;

  // Предоплата по правилам магазина: переводом сразу после оформления (наличными — только если так настроено).
  const paySet = paySettings.data;
  const prepayPct =
    paySet && !nothingToPay && !(form.paymentMethod === 'Cash' && !paySet.prepaymentForCash) ? paySet.prepaymentPercent : 0;
  const prepay = prepayPct > 0 ? Math.min(total, Math.ceil((total * prepayPct) / 100)) : 0;
  const payMethods = Object.entries(PAYMENT_METHOD).filter(([value]) => !paySet || methodEnabled(paySet, value));

  // Оформить нельзя, пока фото не подогнаны под форму или ещё читаются из браузера.
  const misfit = items.some((i) => misfitPhotos(i).length);
  const photosLoading = !buyNowItem && cart.photosState === 'loading';

  // Промокод проверяет сервер: срок, лимиты (в т.ч. на одного клиента) — с понятным текстом ошибки.
  const applyPromo = async () => {
    setPromoError('');
    const code = promoInput.trim();
    if (!code || promoBusy) return;
    setPromoBusy(true);
    try {
      setPromo(await promoCheckApi.validate(code));
    } catch (e) {
      setPromoError(e.messages?.[0] || 'Не удалось проверить промокод.');
    } finally {
      setPromoBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current || misfit || photosLoading || !items.length) return; // защита от двойного нажатия
    const invalid = contactErrors(form.contactName, form.contactPhone);
    if (invalid) return setError(invalid);
    submitting.current = true;
    setError(null);
    setStage('order');
    const ordered = items;
    try {
      const created = await ordersApi.create({
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim() || null,
        // Самовывоз — без города и адреса (deliveryCityId: null)
        deliveryCityId: pickup ? null : form.deliveryCityId || null,
        deliveryAddress: pickup ? null : form.deliveryAddress.trim() || null,
        paymentMethod: form.paymentMethod,
        source: 'Website',
        promoCodeId: usePromo ? promo.id : null,
        comboOfferId: useCombo ? combo.id : null,
        coinsUsed,
        items: ordered.map((i) => ({ productVariantId: i.variantId, quantity: i.quantity })),
      });

      // Фото: загружаем по одному. Неудачные не теряем — они остаются в корзине («не догрузились»)
      // с кадрами, их можно отправить ещё раз; удачные из браузера убираем.
      const issues = { orderId: created.id, uploadFailed: 0, cropFailed: 0, skipped: 0, rememberFailed: false };
      const pendingEntries = [];
      const withPhotos = ordered.filter((i) => i.photos.length);
      if (withPhotos.length) {
        setStage('photos');
        let order = null;
        try {
          order = await ordersApi.mineGet(created.id);
        } catch {
          /* позиции заказа не узнали — фото отправим повторно из корзины */
        }
        for (const item of withPhotos) {
          const orderItem = order?.items?.find((oi) => oi.productVariantId === item.variantId);
          const left = [];
          if (!orderItem) {
            issues.skipped += item.photos.length;
            left.push(...item.photos);
          } else {
            for (const file of item.photos) {
              // eslint-disable-next-line no-await-in-loop
              const r = await uploadCartPhoto(orderItem.id, file);
              if (r === 'fail') issues.uploadFailed++;
              if (r === 'crop') issues.cropFailed++;
              if (r !== 'ok') left.push(file);
            }
          }
          if (left.length) {
            pendingEntries.push({
              key: `${created.id}:${item.variantId}`,
              orderId: created.id,
              orderNumber: created.orderNumber,
              orderItemId: orderItem?.id ?? null,
              variantId: item.variantId,
              productId: item.productId,
              name: item.name,
              image: item.image,
              photos: left,
            });
          }
        }
      }

      // Сохраняем контакты в профиль — в следующий раз подставятся сами. Ошибка здесь заказ не ломает, но о ней говорим.
      if (remember && differsFromProfile) {
        try {
          await profileApi.update({
            fullName: profile.fullName || '',
            bio: profile.bio ?? null,
            avatarUrl: profile.avatarUrl ?? null,
            phoneNumber: form.contactPhone.trim() || null,
            deliveryCityId: pickup ? profile.deliveryCityId ?? null : form.deliveryCityId || null,
            deliveryAddress: pickup ? profile.deliveryAddress ?? null : form.deliveryAddress.trim() || null,
          });
        } catch {
          issues.rememberFailed = true;
        }
      }

      if (coinsUsed > 0 || (remember && differsFromProfile)) refreshProfile();
      cart.addPending(pendingEntries);
      if (buyNowItem) cart.setBuyNow(null);
      else cart.removeMany(ordered.map((i) => i.variantId));

      const hasIssues = issues.uploadFailed + issues.cropFailed + issues.skipped > 0 || issues.rememberFailed;
      if (hasIssues) {
        try {
          localStorage.setItem(orderIssuesKey(created.orderNumber), JSON.stringify(issues));
        } catch { /* ignore */ }
      }
      navigate(`/order/${created.orderNumber}`, { replace: true, state: { order: created, issues } });
    } catch (err) {
      setError(err);
      setStage('');
      submitting.current = false;
    }
  };

  const busyLabel = stage === 'photos' ? 'Загружаем фото…' : stage === 'order' ? 'Оформляем…' : null;
  const submitDisabled = !!busyLabel || misfit || photosLoading;

  return (
    <div className="site-container chk-page">
      <header className="chk-head">
        <Link to={buyNowItem && navState?.productId ? `/product/${navState.productId}` : '/cart'} className="chk-back">
          {buyNowItem ? 'Назад к товару' : 'Назад в корзину'}
        </Link>
        <h1 className="site-title">Оформление заказа</h1>
        <p className="site-lead">
          {buyNowItem
            ? 'Покупка в один клик: оформляем только этот товар, корзина остаётся как была.'
            : 'Три коротких шага. После заказа менеджер позвонит тебе и подтвердит детали.'}
        </p>
      </header>

      {!buyNowRequested && (
        <div className="chk-checks">
          <CartCheckNotice check={check} />
        </div>
      )}

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
          </section>

          <section className="site-surface chk-section" aria-labelledby="chk-delivery">
            <div className="chk-section__head">
              <span className="chk-step" aria-hidden="true">2</span>
              <h2 id="chk-delivery">Доставка</h2>
            </div>
            <div className="chk-pay" role="radiogroup" aria-label="Способ получения">
              {[
                ['delivery', 'Доставка', noCities ? 'Сейчас недоступна' : 'Курьер привезёт по адресу'],
                ['pickup', 'Самовывоз', 'Бесплатно, адрес подскажет менеджер'],
              ].map(([value, label, desc]) => {
                const active = (pickup ? 'pickup' : 'delivery') === value;
                const disabled = value === 'delivery' && noCities;
                return (
                  <label key={value} className={`chk-pay__option${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}>
                    <input
                      type="radio"
                      name="delivery-mode"
                      value={value}
                      checked={active}
                      disabled={disabled}
                      onChange={() => setMode(value)}
                    />
                    <span className="chk-pay__dot" aria-hidden="true" />
                    <span className="chk-pay__title">{label}</span>
                    <span className="chk-pay__desc">{desc}</span>
                  </label>
                );
              })}
            </div>
            {!pickup && cities.error && (
              <div className="chk-fields">
                <ErrorBox error={cities.error} onRetry={cities.reload} />
                <p className="chk-fine">Не удалось загрузить города доставки. Повтори или выбери самовывоз.</p>
              </div>
            )}
            {!pickup && !cities.error && (
              <div className="chk-fields">
                <Select
                  label="Город"
                  required
                  placeholder={cities.loading && !cities.data ? 'Загружаем города…' : 'Выбери город'}
                  value={form.deliveryCityId}
                  onChange={set('deliveryCityId')}
                  options={(cities.data?.items ?? []).map((c) => ({
                    value: c.id,
                    label: `${nameOf(c)}, ${Number(c.deliveryCost) === 0 ? 'бесплатно' : money(c.deliveryCost)}`,
                  }))}
                />
                <Textarea
                  label="Адрес"
                  required
                  placeholder="Улица, дом, квартира"
                  value={form.deliveryAddress}
                  onChange={set('deliveryAddress')}
                  autoComplete="street-address"
                />
              </div>
            )}
            {differsFromProfile && (
              <label className="chk-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>
                  {pickup ? 'Запомнить телефон для следующих заказов' : 'Запомнить телефон и адрес для следующих заказов'}
                  <small>Сохранятся в профиле — изменить их можно в личном кабинете</small>
                </span>
              </label>
            )}
          </section>

          <section className="site-surface chk-section" aria-labelledby="chk-payment">
            <div className="chk-section__head">
              <span className="chk-step" aria-hidden="true">3</span>
              <h2 id="chk-payment">Оплата</h2>
            </div>
            {nothingToPay ? (
              <p className="chk-note chk-note--ok">Скидки и монеты покрывают весь заказ — оплачивать ничего не нужно.</p>
            ) : (
              <div className="chk-pay" role="radiogroup" aria-labelledby="chk-payment">
                {payMethods.map(([value, label]) => (
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
            )}
          </section>
        </div>

        <aside className="site-surface chk-summary" aria-labelledby="chk-summary-title">
          <h2 id="chk-summary-title">Твой заказ</h2>
          <ul className="chk-items">
            {items.map((i) => {
              const pct = tierPercent(i.tiers, i.quantity);
              return (
                <li key={i.variantId}>
                  <span className="chk-items__name">
                    <span>{i.name}</span>
                    <span className="chk-items__qty">
                      {i.quantity} шт.
                      {pct > 0 && ` · −${percentLabel(pct)}% за количество`}
                      {i.photos.length > 0 && <span className="chk-items__photos"> · фото: {i.photos.length}</span>}
                    </span>
                  </span>
                  <span className="chk-money">{money(itemTotal(i))}</span>
                </li>
              );
            })}
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
                  <button type="button" className="btn btn--ghost" onClick={applyPromo} disabled={promoBusy}>
                    {promoBusy ? 'Проверяем…' : 'Применить'}
                  </button>
                )}
              </div>
              {promoError && (
                <p className="field__error" id="promo-error" role="alert">
                  {promoError}
                </p>
              )}
              {promo && <p className="chk-applied">Промокод {promo.code} принят</p>}
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
                    aria-invalid={coinsOver || undefined}
                    value={coinsInput}
                    onChange={(e) => setCoinsInput(e.target.value)}
                    onBlur={() => {
                      if (coinsInput !== '') setCoinsInput(coinsUsed ? String(coinsUsed) : '');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault(); // случайный Enter не оформляет заказ
                    }}
                  />
                  <button type="button" className="btn btn--ghost" onClick={() => setCoinsInput(String(maxCoins))} disabled={!maxCoins}>
                    Все {maxCoins}
                  </button>
                </div>
                <p className={`field__hint${coinsOver ? ' chk-hint--warn' : ''}`} id="coins-hint" aria-live="polite">
                  {coinsOver
                    ? `Можно списать максимум ${maxCoins} — спишем ${maxCoins}.`
                    : `1 монета = 1 сомони, максимум ${maxCoins}.`}
                </p>
              </div>
            )}
          </div>

          <div className="chk-rows">
            <div className="chk-row">
              <span>Товары</span>
              <span className="chk-money">{money(subtotal)}</span>
            </div>
            {usePromo && promoDiscount > 0 && (
              <div className="chk-row chk-row--discount">
                <span>Скидка {promo.code}</span>
                <span className="chk-money">−{money(discount)}</span>
              </div>
            )}
            {useCombo && (
              <div className="chk-row chk-row--discount">
                <span>
                  Комбо «{nameOf(combo)}» {discountLabel(combo)}
                </span>
                <span className="chk-money">−{money(discount)}</span>
              </div>
            )}
            {bothApply && (
              <p className="chk-fine chk-discount-note">
                Промокод и комбо не суммируются — применена более выгодная скидка
                {usePromo ? ` (промокод ${promo.code})` : ` (комбо «${nameOf(combo)}»)`}.
              </p>
            )}
            {coinsUsed > 0 && (
              <div className="chk-row chk-row--discount">
                <span>Монетами</span>
                <span className="chk-money">−{money(coinsUsed)}</span>
              </div>
            )}
            <div className="chk-row">
              <span>Доставка</span>
              <span className="chk-money">
                {pickup ? 'самовывоз' : city ? (delivery === 0 ? 'бесплатно' : money(delivery)) : 'выбери город'}
              </span>
            </div>
            <div className="chk-row chk-row--total">
              <span>Итого</span>
              <span className="chk-total chk-money">{money(total)}</span>
            </div>
          </div>
          {prepay > 0 && (
            <div className="chk-row chk-row--prepay">
              <span>{prepayPct === 100 ? 'Оплата сразу после оформления' : `Предоплата ${prepayPct}% после оформления`}</span>
              <span className="chk-money">{money(prepay)}</span>
            </div>
          )}
          <p className="chk-fine">
            {nothingToPay
              ? 'К оплате 0 смн — менеджер позвонит, чтобы подтвердить заказ.'
              : prepay > 0
                ? prepayPct === 100
                  ? 'После оформления покажем реквизиты — переведи сумму и загрузи чек.'
                  : `После оформления покажем реквизиты: переведи предоплату и загрузи чек. Остаток ${money(total - prepay)} — до получения заказа.`
                : 'Итоговую сумму подтвердит менеджер, когда позвонит уточнить заказ.'}
          </p>

          {misfit && (
            <p className="chk-note chk-note--warn" role="alert">
              Некоторые фото не подогнаны под форму стикера.{' '}
              <Link to={buyNowItem && navState?.productId ? `/product/${navState.productId}` : '/cart'} className="text-link">
                Подогнать
              </Link>
            </p>
          )}
          {photosLoading && <p className="chk-note">Загружаем сохранённые фото…</p>}
          {!buyNowItem && cart.photosState === 'failed' && (
            <p className="chk-note chk-note--warn" role="alert">
              Не удалось прочитать сохранённые фото из браузера — без них они не прикрепятся к заказу. Обнови страницу
              или добавь фото в корзине заново.
            </p>
          )}

          <div ref={errorRef}>
            <ErrorBox error={error} />
          </div>
          <button className="btn btn--primary btn--large btn--block chk-go" disabled={submitDisabled}>
            {busyLabel || 'Подтвердить заказ'}
          </button>
          <p className="chk-fine chk-legal">
            Оформляя заказ, ты соглашаешься с{' '}
            <Link to="/terms" className="text-link">
              условиями оферты
            </Link>
            ,{' '}
            <Link to="/refund" className="text-link">
              политикой возврата
            </Link>{' '}
            и{' '}
            <Link to="/privacy" className="text-link">
              обработкой персональных данных
            </Link>
            .
          </p>
          <p className="chk-fine chk-faq">
            <Link to="/faq" className="text-link">
              Условия возврата и FAQ
            </Link>
          </p>
        </aside>

        <div className="chk-bar">
          <div className="chk-bar__sum">
            <span className="chk-bar__label">Итого</span>
            <span className="chk-bar__value chk-money">{money(total)}</span>
          </div>
          <button className="btn btn--primary btn--large" disabled={submitDisabled}>
            {busyLabel || 'Подтвердить заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}
