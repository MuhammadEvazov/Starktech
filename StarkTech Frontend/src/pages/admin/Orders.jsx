import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearch } from '../../lib/router.jsx';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { chatApi, citiesApi, dashboardApi, ordersApi, productsApi, variantsApi } from '../../api/endpoints.js';
import {
  attrValue, dateTime, money, nameOf, ORDER_SOURCE, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, parseJson,
} from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Async, Empty, ErrorBox, Input, Modal, OrderStatusBadge, Pagination, PaymentStatusBadge, Select, Textarea,
} from '../../components/ui.jsx';
import { OrderItemPhotos } from '../account/Account.jsx';
import { Stepper } from '../shop/Product.jsx';
import { ConfirmDelete } from './CrudPage.jsx';
import VariantPicker from '../../components/VariantPicker.jsx';

// OrderService.AllowedTransitions — статус меняется только на следующий шаг.
const NEXT = { New: 'Confirmed', Confirmed: 'InProduction', InProduction: 'ReadyForDelivery', ReadyForDelivery: 'Delivered' };
const opts = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));

// Порядок чипов — путь заказа; у каждого статуса свой цвет (тот же на полосе строки).
const STATUS_ORDER = ['New', 'Confirmed', 'InProduction', 'ReadyForDelivery', 'Delivered', 'Cancelled'];

export function Orders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearch();
  const [creating, setCreating] = useState(false);
  const [number, setNumber] = useState(params.orderNumber || '');
  const debouncedNumber = useDebounced(number, 300);
  const page = Number(params.page || 1);

  // Номер ищется с задержкой, чтобы не дёргать сервер на каждую букву.
  useEffect(() => {
    if ((params.orderNumber || '') !== debouncedNumber) setParams({ ...params, orderNumber: debouncedNumber, page: 1 });
  }, [debouncedNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useAsync(
    () =>
      ordersApi.list({
        page,
        pageSize: 20,
        status: params.status,
        paymentStatus: params.paymentStatus,
        orderNumber: params.orderNumber,
        createdFrom: params.from ? new Date(params.from).toISOString() : undefined,
        createdTo: params.to ? new Date(params.to + 'T23:59:59').toISOString() : undefined,
      }),
    [page, params.status, params.paymentStatus, params.orderNumber, params.from, params.to],
  );
  // Счётчики на чипах статусов — из сводки дашборда (по всем заказам).
  const counts = useAsync(() => dashboardApi.get(7).then((d) => d.pipeline).catch(() => ({})), []);

  const update = (patch) => setParams({ ...params, ...patch, page: 1 });
  const hasFilters = !!(params.status || params.paymentStatus || params.orderNumber || params.from || params.to);
  const reset = () => {
    setNumber('');
    setParams({});
  };

  return (
    <>
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Заказы</h1>
          <p className="muted">Нажмите на заказ, чтобы позвонить клиенту, сменить статус или добавить фото.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          Заказ из Instagram
        </button>
      </header>

      <div className="filterbar orders-filter" role="search">
        <div className="filterbar__top">
          <label className="search-field">
            <span className="sr-only">Номер заказа</span>
            <svg className="search-field__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              className="search-field__input"
              placeholder="Найти по номеру, например ST-2026…"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </label>

          <div className="orders-dates">
            <label>
              <span>с</span>
              <input type="date" className="orders-dates__input" value={params.from || ''} onChange={(e) => update({ from: e.target.value })} />
            </label>
            <label>
              <span>по</span>
              <input type="date" className="orders-dates__input" value={params.to || ''} onChange={(e) => update({ to: e.target.value })} />
            </label>
          </div>

          <div className="filterbar__meta" aria-live="polite">
            {list.data && <span className="filterbar__count">Найдено: {list.data.totalCount}</span>}
            {hasFilters && (
              <button type="button" className="filterbar__reset" onClick={reset}>
                Сбросить
              </button>
            )}
          </div>
        </div>

        <div className="orders-status" role="radiogroup" aria-label="Статус заказа">
          <button
            type="button"
            role="radio"
            aria-checked={!params.status}
            className={`orders-status__chip ${!params.status ? 'is-on' : ''}`}
            onClick={() => update({ status: '' })}
          >
            Все
          </button>
          {STATUS_ORDER.map((s) => {
            const on = params.status === s;
            const n = counts.data?.[s];
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                className={`orders-status__chip st-${s} ${on ? 'is-on' : ''}`}
                onClick={() => update({ status: on ? '' : s })}
              >
                <span className="orders-status__dot" aria-hidden="true" />
                {ORDER_STATUS[s]}
                {n > 0 && <span className="orders-status__count">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="chip-group chip-group--segment orders-pay" role="radiogroup" aria-label="Оплата">
          {[['', 'Любая оплата'], ...Object.entries(PAYMENT_STATUS)].map(([value, label]) => {
            const on = (params.paymentStatus || '') === value;
            return (
              <button
                key={value || 'all'}
                type="button"
                role="radio"
                aria-checked={on}
                className={`fchip ${on ? 'is-on' : ''}`}
                onClick={() => update({ paymentStatus: value })}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <Async
        state={list}
        empty={
          <div className="section-empty">
            <p className="section-empty__title">{hasFilters ? 'По этим условиям заказов нет' : 'Заказов пока нет'}</p>
            <p>
              {hasFilters
                ? 'Попробуйте другой статус или даты — или сбросьте фильтры.'
                : 'Заказы с сайта появятся здесь сами. Заказ из переписки в Instagram добавьте кнопкой «Заказ из Instagram».'}
            </p>
          </div>
        }
      >
        {(data) => (
          <>
            <ul className="orders-list">
              {data.items.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`} className={`orders-row st-${o.status}`}>
                    <span className="orders-row__main">
                      <span className="orders-row__number">{o.orderNumber}</span>
                      <span className="orders-row__date">
                        {dateTime(o.createdAt)}, {ORDER_SOURCE[o.source] || o.source}
                      </span>
                    </span>
                    <span className="orders-row__client">
                      <span className="orders-row__avatar" aria-hidden="true">
                        {(o.contactName || '?').trim()[0]?.toUpperCase()}
                      </span>
                      <span>
                        <span className="orders-row__name">{o.contactName}</span>
                        <span className="orders-row__phone">{o.contactPhone}</span>
                      </span>
                    </span>
                    <span className="orders-row__badges">
                      <OrderStatusBadge status={o.status} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                      {o.hasClientChanges && <span className="orders-row__changed">Изменён клиентом</span>}
                      <span className="orders-row__method">{PAYMENT_METHOD[o.paymentMethod]}</span>
                    </span>
                    <span className="orders-row__sum">{money(o.payableAmount)}</span>
                    <svg className="orders-row__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => setParams({ ...params, page: p })} />
          </>
        )}
      </Async>

      {creating && <ManualOrder onClose={() => setCreating(false)} onCreated={(o) => navigate(`/admin/orders/${o.id}`)} />}
    </>
  );
}

// Путь заказа — настоящая последовательность, поэтому шкала с номерами.
const STAGES = ['New', 'Confirmed', 'InProduction', 'ReadyForDelivery', 'Delivered'];
const PAY_TONE = { Pending: 'wait', Paid: 'ok', Failed: 'bad', Refunded: 'muted' };

/** Телефон в формат для ссылки WhatsApp: только цифры, с кодом Таджикистана. */
const waPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length === 9 ? `992${digits}` : digits;
};

/** Открыть (или начать) переписку с владельцем заказа в разделе «Чат». */
function ChatWithClient({ userId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const c = await chatApi.forCustomer(userId);
      navigate(`/admin/chat?c=${c.id}`);
    } catch (e) {
      toast(e.messages?.[0] || 'Не удалось открыть чат');
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn btn--primary btn--small" onClick={open} disabled={busy}>
      {busy ? 'Открываем…' : 'Написать в чат'}
    </button>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const order = useAsync(() => ordersApi.get(id), [id]);
  const cities = useAsync(() => citiesApi.list({ pageSize: 100 }), []);
  const activity = useAsync(() => ordersApi.activity(id), [id]);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const act = async (fn, msg) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast(msg);
      order.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Async state={order}>
      {(o) => {
        const next = NEXT[o.status];
        const editable = o.status === 'New' || o.status === 'Confirmed';
        const cancelled = o.status === 'Cancelled';
        const closed = o.status === 'Delivered' || cancelled;
        const stageIndex = STAGES.indexOf(o.status);
        const city = cities.data?.items?.find((c) => c.id === o.deliveryCityId);
        const wa = waPhone(o.contactPhone);
        const itemsCount = o.items.reduce((s, i) => s + i.quantity, 0);

        return (
          <div className="order-detail order-page">
            <div className="page-top">
              <Link to="/admin/orders" className="back-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Все заказы
              </Link>
              <nav className="crumbs-admin" aria-label="Навигация">
                <Link to="/admin/orders">Заказы</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{o.orderNumber}</span>
              </nav>
            </div>

            {/* Шапка заказа: номер-стикер, статусы и главное действие */}
            <section className="order-hero">
              <div className="order-hero__main">
                <span className="order-hero__number">{o.orderNumber}</span>
                <div className="order-hero__badges">
                  <OrderStatusBadge status={o.status} />
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
                <p className="order-hero__meta">
                  {ORDER_SOURCE[o.source]}, создан {dateTime(o.createdAt)}
                  {o.updatedAt && <>, изменён {dateTime(o.updatedAt)}</>}
                </p>
              </div>
              <div className="order-hero__actions">
                {next && (
                  <button
                    type="button"
                    className="btn btn--primary btn--large"
                    disabled={busy}
                    onClick={() => act(() => ordersApi.updateStatus(o.id, next), `Статус: ${ORDER_STATUS[next]}`)}
                  >
                    {busy ? 'Сохраняем…' : `Перевести в «${ORDER_STATUS[next]}»`}
                  </button>
                )}
                {!closed && (
                  <button type="button" className="btn btn--ghost order-hero__cancel" disabled={busy} onClick={() => setCancelling(true)}>
                    Отменить заказ
                  </button>
                )}
              </div>

              {cancelled ? (
                <p className="order-cancelled" role="status">
                  Заказ отменён. Промокод и монеты вернулись клиенту.
                </p>
              ) : (
                <ol className="order-track" aria-label="Этапы заказа">
                  {STAGES.map((s, i) => (
                    <li
                      key={s}
                      className={i < stageIndex ? 'is-done' : i === stageIndex ? 'is-current' : ''}
                      aria-current={i === stageIndex ? 'step' : undefined}
                    >
                      <span className="order-track__dot" aria-hidden="true">{i < stageIndex ? '✓' : i + 1}</span>
                      <span className="order-track__label">{ORDER_STATUS[s]}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <ErrorBox error={error} />

            {o.hasClientChanges && (
              <section className="order-changes" aria-labelledby="order-changes-title">
                <div className="order-changes__head">
                  <h2 id="order-changes-title">Клиент изменил заказ</h2>
                  <button
                    type="button"
                    className="btn btn--small order-changes__seen"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await ordersApi.activitySeen(o.id);
                        activity.reload();
                      }, 'Изменения отмечены просмотренными')
                    }
                  >
                    Отметить просмотренным
                  </button>
                </div>
                <ul className="order-changes__list">
                  {(activity.data ?? [])
                    .filter((a) => a.byClient && !a.isSeen)
                    .map((a) => (
                      <li key={a.id}>
                        <span>{a.message}</span>
                        <time dateTime={a.createdAt}>{dateTime(a.createdAt)}</time>
                      </li>
                    ))}
                </ul>
                <p className="order-changes__hint">Проверьте фото у товаров ниже, прежде чем переводить заказ дальше.</p>
              </section>
            )}

            <div className="order-grid">
              {/* Клиент */}
              <section className="panel od-panel">
                <h2 className="section__title">Клиент</h2>
                <div className="order-client">
                  <span className="order-client__avatar" aria-hidden="true">
                    {(o.contactName || '?').trim()[0]?.toUpperCase()}
                  </span>
                  <div>
                    <p className="order-client__name">{o.contactName}</p>
                    <a href={`tel:${o.contactPhone}`} className="order-client__phone">{o.contactPhone}</a>
                    {o.contactEmail && <p className="order-client__email">{o.contactEmail}</p>}
                  </div>
                </div>
                <div className="order-client__actions">
                  {o.userId && <ChatWithClient userId={o.userId} />}
                  <a href={`tel:${o.contactPhone}`} className="btn btn--ghost btn--small">Позвонить</a>
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(`Здравствуйте! Это StarkTech, по заказу ${o.orderNumber}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--ghost btn--small"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
                <dl className="order-facts">
                  <div>
                    <dt>Доставка</dt>
                    <dd>{city ? nameOf(city) : o.deliveryCityId ? '…' : 'Самовывоз'}</dd>
                  </div>
                  {o.deliveryAddress && (
                    <div>
                      <dt>Адрес</dt>
                      <dd>{o.deliveryAddress}</dd>
                    </div>
                  )}
                </dl>
                {!o.userId && (
                  <p className="order-note">
                    Заказ оформлен без аккаунта: клиент не видит его в кабинете и не может загрузить фото на сайт.
                    Фото для печати он может прислать в WhatsApp.
                  </p>
                )}
              </section>

              {/* Оплата — как чек */}
              <section className="panel od-panel">
                <h2 className="section__title">Оплата</h2>
                <p className="order-paymethod">{PAYMENT_METHOD[o.paymentMethod]}</p>
                <dl className="order-receipt">
                  <div>
                    <dt>Товары ({itemsCount} шт.)</dt>
                    <dd>{money(o.totalAmount)}</dd>
                  </div>
                  {Number(o.discountAmount) > 0 && (
                    <div className="is-minus">
                      <dt>Скидка{o.promoCodeId ? ', промокод' : ''}{o.comboOfferId ? ', комбо' : ''}</dt>
                      <dd>−{money(o.discountAmount)}</dd>
                    </div>
                  )}
                  {o.coinsUsed > 0 && (
                    <div className="is-minus">
                      <dt>Монетами</dt>
                      <dd>−{money(o.coinsUsed)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Доставка</dt>
                    <dd>{Number(o.deliveryCost) === 0 ? 'бесплатно' : money(o.deliveryCost)}</dd>
                  </div>
                  <div className="order-receipt__total">
                    <dt>К оплате</dt>
                    <dd>{money(o.payableAmount)}</dd>
                  </div>
                </dl>
                {o.coinsEarned > 0 && <p className="muted small">Клиенту начислено монет: {o.coinsEarned}</p>}

                {!cancelled && (
                  <div className="order-paystatus">
                    <span className="field__label" id="paystatus-label">Статус оплаты</span>
                    <div className="order-paystatus__options" role="radiogroup" aria-labelledby="paystatus-label">
                      {Object.entries(PAYMENT_STATUS).map(([value, label]) => {
                        const on = o.paymentStatus === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={busy || on}
                            className={`order-paystatus__opt tone-${PAY_TONE[value]} ${on ? 'is-on' : ''}`}
                            onClick={() => act(() => ordersApi.updateStatus(o.id, o.status, value), `Оплата: ${label}`)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Товары */}
            <section className="section">
              <header className="section__head">
                <div>
                  <h2 className="section__title">
                    Товары
                    <span className="section__count">{o.items.length}</span>
                  </h2>
                  <p className="section__lead">
                    {editable
                      ? 'Пока заказ новый, можно менять количество, добавлять и убирать товары. Фото под товарами загружает только клиент.'
                      : 'Состав можно менять, только пока заказ «Новый» или «Подтверждён». Фото под товарами загружает только клиент.'}
                  </p>
                </div>
                {editable && (
                  <div className="section__actions">
                    <button type="button" className="btn btn--ghost" onClick={() => setAdding(true)}>
                      Добавить товар
                    </button>
                  </div>
                )}
              </header>
              <ul className="order-items order-items--admin">
                {o.items.map((item) => (
                  <li key={item.id}>
                    <OrderItemPhotos
                      item={item}
                      canUpload={false}
                      deleteNote="Это фото прислал клиент для печати. Без него макет не сделать — клиенту придётся отправить фото снова."
                    >
                      {(editable || item.sku) && (
                        <div className="order-item-admin__edit">
                          {editable && (
                            <>
                              <Stepper
                                value={item.quantity}
                                onChange={(q) => act(() => ordersApi.updateItem(o.id, item.id, q), 'Количество изменено')}
                              />
                              <button
                                type="button"
                                className="btn btn--quiet btn--small"
                                disabled={o.items.length < 2}
                                title={o.items.length < 2 ? 'В заказе должен остаться хотя бы один товар' : undefined}
                                onClick={() => act(() => ordersApi.removeItem(o.id, item.id), 'Товар убран из заказа')}
                              >
                                Убрать из заказа
                              </button>
                            </>
                          )}
                          {item.sku && <span className="muted small">Артикул {item.sku}</span>}
                        </div>
                      )}
                    </OrderItemPhotos>
                  </li>
                ))}
              </ul>
            </section>

            {(activity.data ?? []).length > 0 && (
              <section className="section">
                <header className="section__head">
                  <h2 className="section__title">
                    История изменений
                    <span className="section__count">{activity.data.length}</span>
                  </h2>
                </header>
                <ol className="order-history">
                  {activity.data.map((a) => (
                    <li key={a.id} className={a.byClient ? 'is-client' : ''}>
                      <span className="order-history__who">{a.byClient ? 'Клиент' : 'Сотрудник'}</span>
                      <span className="order-history__msg">{a.message}</span>
                      <time dateTime={a.createdAt}>{dateTime(a.createdAt)}</time>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {adding && (
              <VariantPicker
                title="Добавить товар в заказ"
                onClose={() => setAdding(false)}
                onPick={async (variantId, qty) => {
                  await ordersApi.addItem(o.id, variantId, qty);
                  setAdding(false);
                  toast('Товар добавлен');
                  order.reload();
                }}
              />
            )}

            {cancelling && (
              <ConfirmDelete
                title="Отменить заказ?"
                text={`Заказ ${o.orderNumber} получит статус «Отменён». Промокод и монеты вернутся клиенту. Вернуть заказ в работу после отмены нельзя.`}
                action="Отменить заказ"
                onCancel={() => setCancelling(false)}
                onConfirm={async () => {
                  await ordersApi.cancel(o.id);
                  setCancelling(false);
                  toast('Заказ отменён');
                  order.reload();
                }}
              />
            )}
          </div>
        );
      }}
    </Async>
  );
}

/** Ручное создание заказа (orders.manual-create), например, из Instagram. */
function ManualOrder({ onClose, onCreated }) {
  const toast = useToast();
  const { session } = useAuth();
  const cities = useAsync(() => citiesApi.list({ isActive: true, pageSize: 100 }), []);
  const [form, setForm] = useState({
    contactName: '', contactPhone: '', contactEmail: '', deliveryCityId: '', deliveryAddress: '',
    paymentMethod: 'Cash', source: 'InstagramManual', userId: '',
  });
  const [items, setItems] = useState([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await ordersApi.create({
        ...form,
        userId: form.userId || null,
        contactEmail: form.contactEmail || null,
        deliveryCityId: form.deliveryCityId || null,
        deliveryAddress: form.deliveryAddress || null,
        coinsUsed: 0,
        items: items.map((i) => ({ productVariantId: i.variantId, quantity: i.quantity })),
      });
      toast(`Заказ ${created.orderNumber} создан`);
      onCreated(created);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Новый заказ вручную" onClose={onClose} wide>
      {!session && <p className="notice">Нужно войти.</p>}
      <form className="form-grid" onSubmit={submit}>
        <Input label="Имя клиента" required value={form.contactName} onChange={set('contactName')} />
        <Input label="Телефон" required value={form.contactPhone} onChange={set('contactPhone')} />
        <Input label="Email" type="email" value={form.contactEmail} onChange={set('contactEmail')} />
        <Select label="Источник" options={opts(ORDER_SOURCE)} value={form.source} onChange={set('source')} />
        <Select
          label="Город"
          placeholder="Самовывоз"
          options={(cities.data?.items ?? []).map((c) => ({ value: c.id, label: `${nameOf(c)}, ${money(c.deliveryCost)}` }))}
          value={form.deliveryCityId}
          onChange={set('deliveryCityId')}
        />
        <Select label="Оплата" options={opts(PAYMENT_METHOD)} value={form.paymentMethod} onChange={set('paymentMethod')} />
        <Textarea label="Адрес" className="form-grid__wide" value={form.deliveryAddress} onChange={set('deliveryAddress')} />
        <Input
          label="ID профиля клиента"
          hint="Необязательно. Guid из таблицы пользователей (Clients.Id)"
          className="form-grid__wide"
          value={form.userId}
          onChange={set('userId')}
        />
        <div className="form-grid__wide">
          <span className="field__label">Товары</span>
          {items.length === 0 && <p className="muted small">Добавьте хотя бы один товар.</p>}
          <ul className="mini-list">
            {items.map((i, idx) => (
              <li key={idx}>
                <span>{i.label} × {i.quantity}</span>
                <button type="button" className="btn btn--quiet btn--small" onClick={() => setItems((l) => l.filter((_, j) => j !== idx))}>
                  Убрать
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setPicking(true)}>
            Добавить товар
          </button>
        </div>
        <div className="form-grid__wide"><ErrorBox error={error} /></div>
        <div className="form-grid__wide form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn--primary" disabled={busy || !items.length}>{busy ? 'Создаём…' : 'Создать заказ'}</button>
        </div>
      </form>
      {picking && (
        <VariantPicker
          title="Товар в заказ"
          onClose={() => setPicking(false)}
          onPick={async (variantId, quantity) => {
            const v = await variantsApi.get(variantId);
            const p = await productsApi.get(v.productId);
            setItems((l) => [...l, { variantId, quantity, label: `${nameOf(p)} (${money(v.price)})` }]);
            setPicking(false);
          }}
        />
      )}
    </Modal>
  );
}
