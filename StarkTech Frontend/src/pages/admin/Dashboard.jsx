import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { dashboardApi, ordersApi } from '../../api/endpoints.js';
import { dateTime, money, ORDER_SOURCE, PAYMENT_METHOD } from '../../lib/format.js';
import { Async, ErrorBox, OrderStatusBadge, PaymentStatusBadge, Spinner } from '../../components/ui.jsx';

const PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
];

const PERIOD_KEY = 'st_admin_dashboard_days';
const readPeriod = () => {
  try {
    const v = Number(localStorage.getItem(PERIOD_KEY));
    return PERIODS.some((p) => p.days === v) ? v : 30;
  } catch {
    return 30;
  }
};

const num = (v) => Number(v ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

/** Сумма с мелкой подписью валюты — крупная цифра не тонет в «смн». */
const Money = ({ value }) => (
  <>
    {num(value)}
    <span className="unit">смн</span>
  </>
);

/** Изменение к прошлому периоду той же длины. */
function delta(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return null;
  const pct = Math.round(((c - p) / p) * 100);
  if (pct === 0) return { text: 'как в прошлом периоде', tone: 'flat' };
  return { text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% к прошлому периоду`, tone: pct > 0 ? 'up' : 'down' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [days, setDays] = useState(readPeriod);
  const dash = useAsync(() => dashboardApi.get(days), [days]);
  const recent = useAsync(() => ordersApi.list({ pageSize: 8 }), []);

  const choose = (d) => {
    setDays(d);
    try {
      localStorage.setItem(PERIOD_KEY, String(d));
    } catch { /* приватный режим */ }
  };

  const d = dash.data;

  return (
    <div className="dash">
      <header className="admin-head">
        <h1 className="admin-title">Обзор</h1>
        <div className="segmented" role="radiogroup" aria-label="Период">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="radio"
              aria-checked={days === p.days}
              className={days === p.days ? 'is-active' : ''}
              onClick={() => choose(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {dash.error ? (
        <ErrorBox error={dash.error} onRetry={dash.reload} />
      ) : !d ? (
        <Spinner />
      ) : (
        <div className={`dash__body ${dash.loading ? 'is-refreshing' : ''}`}>
          <ProductionLine pipeline={d.pipeline} />
          <Attention a={d.attention} />
          <KpiStrip d={d} days={days} />

          <div className="dash-row dash-row--main">
            <section className="panel dash-chart-panel">
              <DailyChart daily={d.daily} hasFinance={!!d.finance} days={days} />
            </section>
            <TopProducts items={d.topProducts} hasFinance={!!d.finance} />
          </div>

          <div className="dash-row dash-row--three">
            <Breakdown
              title="Города доставки"
              rows={d.topCities.map((c) => ({ key: c.cityId ?? 'pickup', label: c.nameRu ?? 'Самовывоз', value: c.orders }))}
            />
            <section className="panel">
              <h2 className="panel__title">Как заказывают</h2>
              <ShareList
                rows={Object.entries(d.orders.byPaymentMethod).map(([k, v]) => ({ key: k, label: PAYMENT_METHOD[k] || k, value: v }))}
              />
              {Object.keys(d.orders.bySource).length > 0 && (
                <>
                  <h3 className="panel__subtitle">Источник</h3>
                  <ShareList rows={Object.entries(d.orders.bySource).map(([k, v]) => ({ key: k, label: ORDER_SOURCE[k] || k, value: v }))} />
                </>
              )}
            </section>
            <Customers c={d.customers} />
          </div>

          <div className="dash-row dash-row--two">
            <Marketing d={d} />
            <ReviewsCatalog r={d.reviews} cat={d.catalog} />
          </div>
        </div>
      )}

      <section className="dash-recent">
        <div className="dash-recent__head">
          <h2 className="subhead">Последние заказы</h2>
          <Link to="/admin/orders" className="text-link">Все заказы</Link>
        </div>
        <Async
          state={recent}
          empty={
            <div className="dash-empty">
              <p>Заказов пока нет. Они появятся здесь, когда клиент оформит заказ на сайте. Заказ из переписки в Instagram можно добавить вручную в разделе «Заказы».</p>
              <Link to="/admin/orders" className="btn btn--ghost btn--small">Заказ из Instagram</Link>
            </div>
          }
        >
          {(data) => (
            <div className="table-wrap">
              <table className="table table--click">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Клиент</th>
                    <th>Статус</th>
                    <th>Оплата</th>
                    <th className="num">Сумма</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id} onClick={() => navigate(`/admin/orders/${o.id}`)}>
                      <td>
                        <Link to={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
                      </td>
                      <td>
                        {o.contactName}
                        <span className="muted small block">{o.contactPhone}</span>
                      </td>
                      <td><OrderStatusBadge status={o.status} /></td>
                      <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                      <td className="num">{money(o.payableAmount)}</td>
                      <td>{dateTime(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
      </section>
    </div>
  );
}

// ─── Линия производства: путь заказа от звонка до доставки ───────────────────
const STATIONS = [
  { status: 'New', label: 'Ждут звонка' },
  { status: 'Confirmed', label: 'Подтверждены' },
  { status: 'InProduction', label: 'В производстве' },
  { status: 'ReadyForDelivery', label: 'Готовы к доставке' },
];

function ProductionLine({ pipeline }) {
  const inWork = STATIONS.reduce((s, st) => s + (pipeline[st.status] || 0), 0);
  return (
    <section className="line" aria-labelledby="line-title">
      <div className="line__head">
        <h2 id="line-title" className="line__title">Заказы в работе</h2>
        <span className="line__meta">{inWork ? `Сейчас в работе: ${num(inWork)}` : 'Очередь пуста'}</span>
        <span className="line__meta line__meta--end">Доставлено за всё время: {num(pipeline.Delivered)}</span>
      </div>
      <ol className="line__stations">
        {STATIONS.map((st) => {
          const v = pipeline[st.status] || 0;
          const hot = st.status === 'New' && v > 0;
          return (
            <li key={st.status} className="line__station">
              <Link to={`/admin/orders?status=${st.status}`} className={`station ${hot ? 'station--hot' : ''} ${v === 0 ? 'station--idle' : ''}`}>
                <span className="station__value">{num(v)}</span>
                <span className="station__label">{st.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Attention({ a }) {
  const items = [
    a.staleNewOrders > 0 && { text: `Больше суток без звонка: ${a.staleNewOrders}`, action: 'Позвонить', to: '/admin/orders?status=New' },
    a.ordersAwaitingPhotos > 0 && { text: `Ждут фото от клиента: ${a.ordersAwaitingPhotos}`, action: 'К заказам', to: '/admin/orders' },
    a.unpaidReadyOrders > 0 && { text: `Готовы или доставлены, но не оплачены: ${a.unpaidReadyOrders}`, action: 'К заказам', to: '/admin/orders' },
    a.pendingReviews > 0 && { text: `Отзывов на модерации: ${a.pendingReviews}`, action: 'Проверить', to: '/admin/reviews' },
  ].filter(Boolean);

  if (!items.length) return null;
  return (
    <ul className="attention" aria-label="Требует внимания">
      {items.map((i) => (
        <li key={i.text}>
          <span className="attention__dot" aria-hidden="true" />
          <span className="attention__text">{i.text}</span>
          <Link to={i.to} className="attention__action">{i.action}</Link>
        </li>
      ))}
    </ul>
  );
}

// ─── Показатели периода: одна полоса, а не россыпь одинаковых карточек ───────
function KpiStrip({ d, days }) {
  const o = d.orders;
  const f = d.finance;
  const cancelRate = o.count ? Math.round((o.cancelled / o.count) * 100) : 0;
  const cells = [
    { label: 'Заказы', value: num(o.count), trend: delta(o.count, o.previousCount), hint: `сегодня ${num(o.today)}` },
    f && { label: 'Выручка', value: <Money value={f.revenue} />, trend: delta(f.revenue, f.previousRevenue), hint: 'без отменённых' },
    f && { label: 'Средний чек', value: <Money value={f.averageCheck} /> },
    f && { label: 'Оплачено', value: <Money value={f.paid} />, hint: f.awaitingPayment > 0 ? `ждёт ${num(f.awaitingPayment)} смн` : null },
    { label: 'Отмены', value: num(o.cancelled), hint: o.count ? `${cancelRate}% заказов` : null, tone: o.cancelled > 0 ? 'down' : null },
    { label: 'Новые клиенты', value: num(d.customers.newClients), hint: `всего ${num(d.customers.totalClients)}` },
  ].filter(Boolean);

  return (
    <section className="kpi-strip" aria-label={`Показатели за ${days} дней`}>
      {cells.map((c) => (
        <div key={c.label} className="kpi">
          <span className="kpi__label">{c.label}</span>
          <span className={`kpi__value ${c.tone === 'down' ? 'kpi__value--down' : ''}`}>{c.value}</span>
          {c.trend && <span className={`kpi__trend kpi__trend--${c.trend.tone}`}>{c.trend.text}</span>}
          {c.hint && <span className="kpi__hint">{c.hint}</span>}
        </div>
      ))}
      {!f && <p className="kpi-strip__note">Суммы денег видны ролям с правом «Финансы».</p>}
    </section>
  );
}

// ─── График по дням: одна серия, одна ось, переключатель метрики ─────────────
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function DailyChart({ daily, hasFinance, days }) {
  const [metric, setMetric] = useState('orders');
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const useRevenue = metric === 'revenue' && hasFinance;
  const values = daily.map((p) => Number(useRevenue ? p.revenue : p.orders) || 0);
  const total = values.reduce((s, v) => s + v, 0);
  const isEmpty = total === 0;
  const max = niceMax(Math.max(...values, 0));
  const fmt = (v) => (useRevenue ? money(v) : num(v));

  const height = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: isEmpty ? 8 : 52 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const step = daily.length ? plotW / daily.length : 0;
  const barW = Math.max(2, Math.min(28, step - 2)); // ≥2px зазор между столбцами
  // Для заказов шкала целочисленная: при малом максимуме меньше делений.
  const tickCount = !useRevenue && max < 4 ? max : 4;
  const ticks = isEmpty ? [0] : Array.from({ length: tickCount + 1 }, (_, i) => (i / tickCount) * max);
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(1, Math.floor(plotW / 64))));

  const barPath = (x, y, w, h) => {
    const r = Math.min(4, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  const hovered = hover != null && !isEmpty ? daily[hover] : null;

  return (
    <>
      <div className="dash-chart__head">
        <div>
          <h2 className="panel__title">{useRevenue ? 'Выручка по дням' : 'Заказы по дням'}</h2>
          <p className="dash-chart__total">{isEmpty ? `За ${days} дней пусто` : `Всего ${fmt(total)}`}</p>
        </div>
        {hasFinance && (
          <div className="segmented segmented--small" role="radiogroup" aria-label="Показатель">
            <button type="button" role="radio" aria-checked={!useRevenue} className={!useRevenue ? 'is-active' : ''} onClick={() => setMetric('orders')}>
              Заказы
            </button>
            <button type="button" role="radio" aria-checked={useRevenue} className={useRevenue ? 'is-active' : ''} onClick={() => setMetric('revenue')}>
              Выручка
            </button>
          </div>
        )}
      </div>

      <div className="dash-chart" ref={boxRef} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${useRevenue ? 'Выручка' : 'Заказы'} по дням, всего ${fmt(total)}`}>
            {ticks.map((t) => {
              const y = pad.top + plotH - (t / max) * plotH;
              return (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className={t === 0 ? 'dash-chart__base' : 'dash-chart__grid'} />
                  {!isEmpty && (
                    <text x={pad.left - 8} y={y} className="dash-chart__axis" textAnchor="end" dominantBaseline="middle">
                      {num(t)}
                    </text>
                  )}
                </g>
              );
            })}
            {daily.map((p, i) => {
              const v = values[i];
              const h = (v / max) * plotH;
              const x = pad.left + i * step + (step - barW) / 2;
              const y = pad.top + plotH - h;
              return (
                <g key={p.date}>
                  {v > 0 && <path d={barPath(x, y, barW, h)} className={`dash-chart__bar ${hover === i ? 'is-hover' : ''}`} />}
                  {/* Зона наведения — на всю высоту и ширину шага, шире самого столбца */}
                  {!isEmpty && (
                    <rect x={pad.left + i * step} y={pad.top} width={Math.max(step, 1)} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
                  )}
                  {i % labelEvery === 0 && (
                    <text x={pad.left + i * step + step / 2} y={height - 8} className="dash-chart__axis" textAnchor="middle">
                      {shortDate(p.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {isEmpty && width > 0 && (
          <p className="dash-chart__empty">
            Здесь появятся столбцы по дням, когда придут первые заказы.
          </p>
        )}
        {hovered && (
          <div className="dash-chart__tip" style={{ left: Math.min(Math.max(pad.left + hover * step + step / 2, 70), width - 70) }}>
            <strong>{shortDate(hovered.date)}</strong>
            <span>Заказов: {num(hovered.orders)}</span>
            {hasFinance && <span>Выручка: {money(hovered.revenue)}</span>}
          </div>
        )}
      </div>

      {!isEmpty && (
        <details className="dash-chart__table">
          <summary>Таблица по дням</summary>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th className="num">Заказы</th>
                  {hasFinance && <th className="num">Выручка</th>}
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{shortDate(p.date)}</td>
                    <td className="num">{num(p.orders)}</td>
                    {hasFinance && <td className="num">{money(p.revenue)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}

// ─── Списки с долями ─────────────────────────────────────────────────────────
function ShareList({ rows }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((r) => r.value), 0);
  if (!sorted.length) return <p className="dash-muted">За период заказов нет.</p>;
  return (
    <ul className="share-list">
      {sorted.map((r) => (
        <li key={r.key}>
          <div className="share-list__row">
            <span>{r.label}</span>
            <span className="share-list__value">{num(r.value)}</span>
          </div>
          <span className="share-list__track" aria-hidden="true">
            <span className="share-list__bar" style={{ width: `${max ? (r.value / max) * 100 : 0}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Breakdown({ title, rows }) {
  return (
    <section className="panel">
      <h2 className="panel__title">{title}</h2>
      <ShareList rows={rows} />
    </section>
  );
}

function TopProducts({ items, hasFinance }) {
  return (
    <section className="panel">
      <h2 className="panel__title">Что покупают</h2>
      {items.length === 0 ? (
        <div className="dash-muted">
          <p>Продаж за период нет.</p>
          <Link to="/admin/products" className="dash-link">Открыть товары</Link>
        </div>
      ) : (
        <ol className="top-list">
          {items.map((p) => (
            <li key={p.productId}>
              <Link to={`/admin/products/${p.productId}`} className="top-list__name">{p.nameRu}</Link>
              <span className="top-list__meta">
                {num(p.quantity)} шт.
                {hasFinance && <> на {money(p.revenue)}</>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Facts({ rows }) {
  return (
    <dl className="dash-facts">
      {rows.filter(Boolean).map(([label, value, to]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{to ? <Link to={to} className="dash-link">{value}</Link> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Customers({ c }) {
  return (
    <section className="panel">
      <h2 className="panel__title">Покупатели</h2>
      <Facts
        rows={[
          ['Покупали с аккаунтом', num(c.buyers)],
          ['Из них повторно', num(c.repeatBuyers)],
          ['Заказы без регистрации', num(c.guestOrders)],
          ['Новые регистрации', num(c.newClients)],
          ['Всего клиентов', num(c.totalClients), '/admin/users'],
        ]}
      />
    </section>
  );
}

function Marketing({ d }) {
  const f = d.finance;
  return (
    <section className="panel">
      <h2 className="panel__title">Скидки и монеты</h2>
      <Facts
        rows={[
          ['Заказы с промокодом', num(d.orders.withPromoCode)],
          ['Заказы с комбо', num(d.orders.withComboOffer)],
          f && ['Сумма скидок', money(f.discounts)],
          f && ['Оплачено монетами', num(f.coinsRedeemed)],
          f && ['Монет на счетах клиентов', num(f.coinsOutstanding), '/admin/coins'],
          f && ['Доставка', money(f.deliveryIncome)],
          f && f.refunded > 0 && ['Возвраты', money(f.refunded)],
          ['Активные промокоды', num(d.catalog.activePromoCodes), '/admin/promo-codes'],
          ['Активные комбо', num(d.catalog.activeComboOffers), '/admin/combo-offers'],
        ]}
      />
    </section>
  );
}

function ReviewsCatalog({ r, cat }) {
  return (
    <section className="panel">
      <h2 className="panel__title">Отзывы и каталог</h2>
      <Facts
        rows={[
          ['Средняя оценка', r.averageRating ? `${r.averageRating.toFixed(1)} из 5, отзывов ${num(r.approved)}` : 'Отзывов пока нет'],
          ['На модерации', num(r.pending), r.pending > 0 ? '/admin/reviews' : null],
          ['Товаров в продаже', num(cat.activeProducts), '/admin/products'],
          ['Скрытых товаров', num(cat.inactiveProducts)],
          cat.productsWithoutImage > 0 && ['Без фото в каталоге', num(cat.productsWithoutImage), '/admin/products'],
          ['Городов доставки', num(cat.activeDeliveryCities), '/admin/delivery-cities'],
        ]}
      />
    </section>
  );
}
