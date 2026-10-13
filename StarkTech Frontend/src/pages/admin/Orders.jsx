import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearch } from '../../lib/router.jsx';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { chatApi, citiesApi, dashboardApi, layoutsApi, ordersApi, productsApi, variantsApi } from '../../api/endpoints.js';
import { assetUrl, http } from '../../api/client.js';
import {
  attrValue, dateTime, LAYOUT_STATUS, money, nameOf, ORDER_SOURCE, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, parseJson,
} from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Async, Empty, ErrorBox, Input, Modal, OrderStatusBadge, Pagination, PaymentStatusBadge, Select, Textarea,
} from '../../components/ui.jsx';
import { OrderItemPhotos, PhotosRetentionNote } from '../account/Account.jsx';
import PaymentReview from './PaymentReview.jsx';
import { Stepper } from '../shop/Product.jsx';
import { ConfirmDelete } from './CrudPage.jsx';
import VariantPicker from '../../components/VariantPicker.jsx';
import PhotoZoom from '../../components/PhotoZoom.jsx';

// OrderService.AllowedTransitions — статус меняется только на следующий шаг.
// Из «Подтверждён» можно сразу в производство или на согласование макета (необязательный шаг).
const TRANSITIONS = {
  New: ['Confirmed'],
  Confirmed: ['InProduction', 'AwaitingLayoutApproval'],
  AwaitingLayoutApproval: ['InProduction'],
  InProduction: ['ReadyForDelivery'],
  ReadyForDelivery: ['Delivered'],
};
// Переход, перед которым сервер проверяет, хватает ли фото у позиций (C11).
const PHOTO_CHECKED = ['AwaitingLayoutApproval', 'InProduction'];
// Макет можно загружать, пока заказ подтверждён или уже на согласовании.
const LAYOUT_STATUSES = ['Confirmed', 'AwaitingLayoutApproval'];

/** Смена статуса заказа; ignoreMissingPhotos — продолжить, хотя фото у позиций не хватает. */
const putStatus = (id, dto) => http.put(`/api/orders/${id}/status`, dto);

/** Граница дня по местному времени: «YYYY-MM-DD» + время → ISO. */
const dayBound = (d, time) => (d ? new Date(`${d}T${time}`).toISOString() : undefined);
const opts = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));

// Порядок чипов — путь заказа; у каждого статуса свой цвет (тот же на полосе строки).
const STATUS_ORDER = ['New', 'Confirmed', 'AwaitingLayoutApproval', 'InProduction', 'ReadyForDelivery', 'Delivered', 'Cancelled'];

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
        // Обе границы — местное время: начало дня «с» и конец дня «по».
        createdFrom: dayBound(params.from, '00:00:00'),
        createdTo: dayBound(params.to, '23:59:59.999'),
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

        <div className="orders-status" role="group" aria-label="Статус заказа">
          <button
            type="button"
            aria-pressed={!params.status}
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
                aria-pressed={on}
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

        <div className="chip-group chip-group--segment orders-pay" role="group" aria-label="Оплата">
          {[['', 'Любая оплата'], ...Object.entries(PAYMENT_STATUS)].map(([value, label]) => {
            const on = (params.paymentStatus || '') === value;
            return (
              <button
                key={value || 'all'}
                type="button"
                aria-pressed={on}
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
          <Empty
            title={hasFilters ? 'По этим условиям заказов нет' : 'Заказов пока нет'}
            action={
              hasFilters && (
                <button type="button" className="btn btn--ghost btn--small" onClick={reset}>
                  Сбросить фильтры
                </button>
              )
            }
          >
            {hasFilters
              ? 'Попробуйте другой статус или даты — или сбросьте фильтры.'
              : 'Заказы с сайта появятся здесь сами. Заказ из переписки в Instagram добавьте кнопкой «Заказ из Instagram».'}
          </Empty>
        }
      >
        {(data) => (
          <>
            <ul className="orders-list">
              {data.items.map((o) => (
                <li key={o.id}>
                  <OrderRow order={o} />
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

/** Строка заказа с цветной полосой статуса — в списке заказов и на обзоре. */
export function OrderRow({ order: o }) {
  return (
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
        {o.hasPendingPaymentProof && <span className="orders-row__changed orders-row__proof">Чек на проверке</span>}
        <span className="orders-row__method">{PAYMENT_METHOD[o.paymentMethod]}</span>
      </span>
      <span className="orders-row__sum">{money(o.payableAmount)}</span>
      <svg className="orders-row__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

// Путь заказа — настоящая последовательность, поэтому шкала с номерами.
// Согласование макета — необязательный шаг: его могут пропустить.
const STAGES = ['New', 'Confirmed', 'AwaitingLayoutApproval', 'InProduction', 'ReadyForDelivery', 'Delivered'];
const OPTIONAL_STAGES = ['AwaitingLayoutApproval'];

/** Ошибка сервера «у позиций не хватает фото» (400 при переводе в макет/производство). */
const isMissingPhotos = (e) => e?.status === 400 && (e.messages || []).some((m) => /фото/i.test(m));

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
  const layouts = useAsync(() => layoutsApi.list(id), [id]);
  const [adding, setAdding] = useState(false);
  // Подтверждение перед сменой статуса: { kind: 'prepay' | 'photos' | 'purge', target, messages }
  const [step, setStep] = useState(null);
  // Подтверждение ручной отметки оплаты: { value, title, text, action }
  const [payConfirm, setPayConfirm] = useState(null);
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

  const changeStatus = async (o, target, { prepayOk = false, ignoreMissingPhotos = false, purgeOk = false } = {}) => {
    // Предоплата не внесена — сначала спрашиваем, точно ли запускать производство.
    if (target === 'InProduction' && Number(o.dueNowAmount) > 0 && !prepayOk) {
      setStep({ kind: 'prepay', target });
      return;
    }
    // «Готов к доставке» — сервер удалит фото клиента; предупреждаем заранее.
    if (target === 'ReadyForDelivery' && !o.photosDeletedAt && !purgeOk) {
      setStep({ kind: 'purge', target });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await putStatus(o.id, { status: target, ...(ignoreMissingPhotos ? { ignoreMissingPhotos: true } : {}) });
      setStep(null);
      toast(`Статус: ${ORDER_STATUS[target]}`);
      order.reload();
      activity.reload();
    } catch (e) {
      if (!ignoreMissingPhotos && PHOTO_CHECKED.includes(target) && isMissingPhotos(e)) {
        setStep({ kind: 'photos', target, messages: e.messages });
      } else {
        setStep(null);
        setError(e);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Async state={order}>
      {(o) => {
        const transitions = TRANSITIONS[o.status] ?? [];
        const editable = o.status === 'New' || o.status === 'Confirmed';
        const cancelled = o.status === 'Cancelled';
        const closed = o.status === 'Delivered' || cancelled;
        const stageIndex = STAGES.indexOf(o.status);
        const hasLayouts = (layouts.data ?? []).length > 0;
        const paid = Number(o.paidAmount) || 0;
        const refundDue = Number(o.refundDueAmount) || 0;
        const overpaid = Number(o.overpaidAmount) || 0;
        // Сколько отмечаем полученным «вне сайта»: остаток, а если его нет — вся сумма к оплате.
        const toReceive = Number(o.remainingAmount) > 0 ? o.remainingAmount : o.payableAmount;
        const payOptions = [
          !cancelled && o.paymentStatus !== 'Paid' && {
            value: 'Paid',
            label: 'Оплата получена (наличными/вне сайта)',
            tone: 'ok',
            title: 'Оплата получена?',
            text: `Отметить, что получено ${money(toReceive)}? Заказ станет «Оплачен».`,
            action: 'Да, получено',
          },
          paid > 0 && o.paymentStatus !== 'Refunded' && {
            value: 'Refunded',
            label: 'Возврат',
            tone: 'muted',
            title: 'Отметить возврат?',
            text: `Отмечайте возврат, только когда деньги (${money(refundDue || paid)}) уже вернули клиенту.`,
            action: 'Деньги вернули',
          },
          !cancelled && o.paymentStatus !== 'Failed' && {
            value: 'Failed',
            label: 'Ошибка оплаты',
            tone: 'bad',
            title: 'Ошибка оплаты?',
            text: 'Отметить, что оплата не прошла? Клиент увидит статус «Ошибка оплаты».',
            action: 'Отметить',
          },
          // «Ожидает оплаты» — только пока ничего не принято (например, вернуть после ошибки).
          !cancelled && paid === 0 && o.paymentStatus !== 'Pending' && {
            value: 'Pending',
            label: PAYMENT_STATUS.Pending,
            tone: 'wait',
            title: 'Вернуть «Ожидает оплаты»?',
            text: 'Статус оплаты снова станет «Ожидает оплаты».',
            action: 'Вернуть',
          },
        ].filter(Boolean);
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
                {transitions.map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn ${i === 0 ? 'btn--primary btn--large' : 'btn--ghost'}`}
                    disabled={busy}
                    onClick={() => changeStatus(o, t)}
                  >
                    {busy && i === 0 ? 'Сохраняем…' : `Перевести в «${ORDER_STATUS[t]}»`}
                  </button>
                ))}
                {transitions.includes('InProduction') && Number(o.dueNowAmount) > 0 && (
                  <p className="od-hint">Предоплата не внесена: ждём ещё {money(o.dueNowAmount)}.</p>
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
                  {refundDue > 0 && <> Нужно вернуть клиенту {money(refundDue)}.</>}
                </p>
              ) : (
                <ol className="order-track" aria-label="Этапы заказа">
                  {STAGES.map((s, i) => {
                    const optional = OPTIONAL_STAGES.includes(s);
                    // Необязательный шаг пройден без макетов — значит, его пропустили.
                    const skipped = optional && i < stageIndex && !!layouts.data && !hasLayouts;
                    const state = skipped ? 'is-skipped' : i < stageIndex ? 'is-done' : i === stageIndex ? 'is-current' : '';
                    return (
                      <li
                        key={s}
                        className={`${state} ${optional ? 'is-optional' : ''}`}
                        aria-current={i === stageIndex ? 'step' : undefined}
                      >
                        <span className="order-track__dot" aria-hidden="true">{skipped ? '–' : i < stageIndex ? '✓' : i + 1}</span>
                        <span className="order-track__label">
                          {ORDER_STATUS[s]}
                          {optional && <small className="order-track__opt">{skipped ? 'пропущен' : 'необязательно'}</small>}
                        </span>
                      </li>
                    );
                  })}
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
                <h2 className="adm-section__title">Клиент</h2>
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
                <h2 className="adm-section__title">Оплата</h2>
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

                {refundDue > 0 && (
                  <p className="od-alert od-alert--danger" role="status">
                    <strong>Нужно вернуть клиенту {money(refundDue)}</strong>
                    Заказ отменён, а оплата уже принята. После возврата отметьте «Возврат».
                  </p>
                )}
                {overpaid > 0 && (
                  <p className="od-alert" role="status">
                    <strong>Переплата {money(overpaid)}</strong>
                    Принято больше, чем к оплате (состав заказа изменился). Нужно вернуть клиенту {money(overpaid)}.
                  </p>
                )}

                {payOptions.length > 0 && (
                  <div className="order-paystatus">
                    <span className="field__label" id="paystatus-label">Отметить вручную</span>
                    <div className="order-paystatus__options" role="group" aria-labelledby="paystatus-label">
                      {payOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={busy}
                          className={`order-paystatus__opt tone-${opt.tone}`}
                          onClick={() => setPayConfirm(opt)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="muted small">«Ожидает оплаты» и «Частично оплачен» ставятся сами по принятым чекам.</p>
                  </div>
                )}

                {/* Чеки переводов от клиента: принять или отклонить */}
                {!cancelled && <PaymentReview order={o} onChanged={order.reload} />}
              </section>
            </div>

            <LayoutSection
              order={o}
              layouts={layouts}
              onChanged={() => {
                order.reload();
                activity.reload();
              }}
            />

            {/* Товары */}
            <section className="adm-section">
              <header className="adm-section__head">
                <div>
                  <h2 className="adm-section__title">
                    Товары
                    <span className="adm-section__count">{o.items.length}</span>
                  </h2>
                  <p className="adm-section__lead">
                    {editable
                      ? 'Пока заказ новый, можно менять количество, добавлять и убирать товары. Фото под товарами загружает только клиент.'
                      : 'Состав можно менять, только пока заказ «Новый» или «Подтверждён». Фото под товарами загружает только клиент.'}
                  </p>
                </div>
                {editable && (
                  <div className="adm-section__actions">
                    <button type="button" className="btn btn--ghost" onClick={() => setAdding(true)}>
                      Добавить товар
                    </button>
                  </div>
                )}
              </header>
              <PhotosRetentionNote order={o} />
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
              <section className="adm-section">
                <header className="adm-section__head">
                  <h2 className="adm-section__title">
                    История изменений
                    <span className="adm-section__count">{activity.data.length}</span>
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

            {step && (
              <Modal
                title={{ prepay: 'Предоплата не внесена', photos: 'Не хватает фото', purge: 'Фото клиента будут удалены' }[step.kind]}
                onClose={busy ? () => {} : () => setStep(null)}
              >
                {step.kind === 'purge' ? (
                  <p>
                    После перевода в «{ORDER_STATUS[step.target]}» все фото, которые прислал клиент, и их подгонка кадра будут
                    удалены безвозвратно. Убедитесь, что заказ изготовлен и фото больше не понадобятся.
                  </p>
                ) : step.kind === 'prepay' ? (
                  <p>
                    Клиент ещё должен внести предоплату {money(o.dueNowAmount)}. Всё равно перевести заказ в «
                    {ORDER_STATUS[step.target]}»?
                  </p>
                ) : (
                  <>
                    <ul className="od-photos-missing">
                      {step.messages.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                    <p>Всё равно продолжить и перевести заказ в «{ORDER_STATUS[step.target]}»?</p>
                  </>
                )}
                <div className="form-actions">
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setStep(null)}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busy}
                    onClick={() =>
                      changeStatus(o, step.target, { prepayOk: true, ignoreMissingPhotos: step.kind === 'photos', purgeOk: true })
                    }
                  >
                    {busy ? 'Сохраняем…' : step.kind === 'purge' ? 'Перевести и удалить фото' : 'Всё равно продолжить'}
                  </button>
                </div>
              </Modal>
            )}

            {payConfirm && (
              <Modal title={payConfirm.title} onClose={busy ? () => {} : () => setPayConfirm(null)}>
                <p>{payConfirm.text}</p>
                <div className="form-actions">
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setPayConfirm(null)}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busy}
                    onClick={() => {
                      const opt = payConfirm;
                      setPayConfirm(null);
                      act(() => ordersApi.updateStatus(o.id, o.status, opt.value), `Оплата: ${PAYMENT_STATUS[opt.value]}`);
                    }}
                  >
                    {payConfirm.action}
                  </button>
                </div>
              </Modal>
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

// Подписи статусов макета для сотрудника (LAYOUT_STATUS — формулировки для клиента).
const LAYOUT_STATUS_ADMIN = { Pending: 'Ждёт ответа клиента' };
const MAX_LAYOUT_MB = 10;

/** «Макет для клиента»: загрузка макета на согласование и ответы клиента. */
function LayoutSection({ order: o, layouts, onChanged }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const fileRef = useRef(null);
  const canUpload = LAYOUT_STATUSES.includes(o.status);
  const list = layouts.data ?? [];

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!canUpload && list.length === 0) return null;

  const pick = (f) => {
    setError(null);
    if (f && f.size > MAX_LAYOUT_MB * 1024 * 1024) {
      setError({ messages: [`Файл больше ${MAX_LAYOUT_MB} МБ.`] });
      return;
    }
    setFile(f || null);
  };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return setError({ messages: ['Выберите файл макета.'] });
    setBusy(true);
    setError(null);
    try {
      await layoutsApi.upload(o.id, file, note.trim() || undefined);
      toast('Макет отправлен клиенту на согласование');
      setFile(null);
      setNote('');
      if (fileRef.current) fileRef.current.value = '';
      layouts.reload();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-section olayout" aria-labelledby="olayout-title">
      <header className="adm-section__head">
        <div>
          <h2 id="olayout-title" className="adm-section__title">
            Макет для клиента
            {list.length > 0 && <span className="adm-section__count">{list.length}</span>}
          </h2>
          <p className="adm-section__lead">
            {canUpload
              ? 'Загрузите макет — заказ перейдёт в «Согласование макета», а клиент одобрит его или попросит правки в личном кабинете. После одобрения заказ сам уйдёт в производство.'
              : 'Новые макеты можно загружать, пока заказ «Подтверждён» или на согласовании макета.'}
          </p>
        </div>
      </header>

      {canUpload && (
        <form className="olayout__form" onSubmit={upload}>
          <div className="olayout__pick">
            {preview ? (
              <img src={preview} alt="Выбранный макет" className="olayout__preview" />
            ) : (
              <span className="olayout__noimg">Файл не выбран</span>
            )}
            <label className="btn btn--ghost btn--small">
              {file ? 'Выбрать другой' : 'Выбрать макет'}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
          </div>
          <Textarea
            label="Комментарий для клиента"
            hint="Необязательно. Например: «Проверьте имя и дату на брелке»"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="form-actions">
            <button className="btn btn--primary" disabled={busy || !file}>
              {busy ? 'Отправляем…' : 'Отправить на согласование'}
            </button>
          </div>
        </form>
      )}

      <ErrorBox error={error || layouts.error} />

      {list.length > 0 && (
        <ul className="olayout__list">
          {list.map((l) => (
            <li key={l.id} className={`olayout__item is-${String(l.status).toLowerCase()}`}>
              <button
                type="button"
                className="olayout__thumb"
                aria-label="Открыть макет крупно"
                onClick={() => setZoom({ src: assetUrl(l.imageUrl), title: `Макет от ${dateTime(l.createdAt)}` })}
              >
                <img src={assetUrl(l.imageUrl)} alt="" loading="lazy" />
              </button>
              <div className="olayout__info">
                <span className="olayout__status">{LAYOUT_STATUS_ADMIN[l.status] || LAYOUT_STATUS[l.status] || l.status}</span>
                <span className="muted small">
                  {dateTime(l.createdAt)}
                  {l.uploadedBy && <>, {l.uploadedBy}</>}
                </span>
                {l.note && <span className="olayout__note">Комментарий: {l.note}</span>}
                {l.customerComment && (
                  <span className="olayout__comment">
                    Клиент: «{l.customerComment}»{l.respondedAt && <> · {dateTime(l.respondedAt)}</>}
                  </span>
                )}
                {!l.customerComment && l.respondedAt && <span className="muted small">Ответ {dateTime(l.respondedAt)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {zoom && <PhotoZoom src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} />}
    </section>
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
