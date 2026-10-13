import '../../styles/site/account.css';
import { useEffect, useState } from 'react';
import { Link, NavLink, Routes, useLocation, useNavigate, useParams } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authApi, citiesApi, layoutsApi, orderPhotosApi, ordersApi, profileApi, variantsApi } from '../../api/endpoints.js';
import { SHAPE_LABEL, shapesFromVariants } from '../../lib/shapes.js';
import { photoCopies, sumCopies } from '../../lib/cartPhotoStore.js';
import { assetUrl } from '../../api/client.js';
import {
  COIN_TYPE,
  date,
  dateTime,
  LAYOUT_STATUS,
  money,
  nameOf,
  ORDER_FLOW,
  ORDER_STATUS,
  parseJson,
  PAYMENT_METHOD,
} from '../../lib/format.js';
import PhotoEditor from '../../components/PhotoEditor.jsx';
import PhotoZoom from '../../components/PhotoZoom.jsx';
import PaymentBox from '../../components/PaymentBox.jsx';
import VariantPicker from '../../components/VariantPicker.jsx';
import { Stepper } from '../shop/Product.jsx';
import { Async, Empty, ErrorBox, Img, ImageUpload, Input, Modal, OrderStatusBadge, Pagination, PaymentStatusBadge, Select, Textarea } from '../../components/ui.jsx';
import { passwordProblems, PasswordRules, PASSWORD_HINT } from '../auth/Auth.jsx';

const coinsWord = (n) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 'монет';
  if (b === 1) return 'монета';
  if (b >= 2 && b <= 4) return 'монеты';
  return 'монет';
};

/** Название товара в заказе: русское, если есть, иначе английское. */
const productName = (item) => item?.productNameRu || item?.productNameEn || 'Товар';

/** Открыть чат с менеджером (ChatWidget слушает это событие). */
const openChat = () => window.dispatchEvent(new Event('chat:open'));

// Фото к товару: те же ограничения, что на сервере.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const photoProblem = (f) => {
  if (!PHOTO_TYPES.includes(f.type)) return 'подходят только JPG, PNG или WEBP';
  if (f.size > PHOTO_MAX_BYTES) return 'файл больше 5 МБ';
  return null;
};

export default function Account() {
  const { profile, logout } = useAuth();
  const { pathname } = useLocation();
  const inOrder = pathname.startsWith('/account/orders/');
  const coins = profile?.coinsBalance ?? 0;
  return (
    <div className="acc-page">
      <header className="acc-head">
        <Img
          src={profile?.avatarUrl}
          className="acc-avatar"
          alt=""
          fallback={
            <span className="acc-avatar acc-avatar--empty" aria-hidden="true">
              {(profile?.fullName || '?')[0]}
            </span>
          }
        />
        <div className="acc-head__who">
          <h1 className="acc-name">{profile?.fullName || 'Личный кабинет'}</h1>
          {profile?.email && <p className="acc-email">{profile.email}</p>}
        </div>
        {profile && (
          <Link to="/account/coins" className="acc-coins" aria-label={`Баланс: ${coins} ${coinsWord(coins)}`}>
            <span className="acc-coins__num">{coins}</span>
            <span className="acc-coins__unit">{coinsWord(coins)}</span>
          </Link>
        )}
        <button type="button" className="acc-logout" onClick={logout}>
          Выйти
        </button>
      </header>

      <nav className="acc-tabs" aria-label="Разделы кабинета">
        <NavLink to="/account" end className={`acc-tabs__item${inOrder ? ' is-active' : ''}`}>
          Заказы
        </NavLink>
        <NavLink to="/account/coins" className="acc-tabs__item">
          Монеты
        </NavLink>
        <NavLink to="/account/profile" className="acc-tabs__item">
          Профиль
        </NavLink>
        <NavLink to="/account/password" className="acc-tabs__item">
          Пароль
        </NavLink>
      </nav>

      <div className="acc-body">
        <Routes
          routes={[
            { path: '/account', element: <MyOrders /> },
            { path: '/account/orders/:id', element: <MyOrder /> },
            { path: '/account/coins', element: <MyCoins /> },
            { path: '/account/profile', element: <ProfileForm /> },
            { path: '/account/password', element: <PasswordForm /> },
          ]}
        />
      </div>
    </div>
  );
}

function Chevron({ dir = 'right' }) {
  return (
    <svg className={`acc-chevron acc-chevron--${dir}`} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const svg = (children) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);
const ICONS = {
  bag: svg(<><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
  coin: svg(<><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></>),
  lock: svg(<><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
  box: svg(<><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>),
  shield: svg(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  user: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>),
  truck: svg(<><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>),
  receipt: svg(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  photo: svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></>),
};

/** Цветная шапка раздела кабинета: иконка (или media — например, загрузка аватара), заголовок, пояснение и (необязательно) цифры справа. */
function AccHero({ id, title, lead, icon, media, tone = 'cobalt', side, children }) {
  return (
    <section className={`acc-prof__hero acc-hero acc-hero--${tone}`} aria-labelledby={id}>
      {media ?? <span className="acc-hero__icon">{icon}</span>}
      <div className="acc-prof__intro">
        <h2 id={id} className="acc-prof__title">
          {title}
        </h2>
        {lead && <p className="acc-prof__lead">{lead}</p>}
        {children}
      </div>
      {side && <div className="acc-hero__side">{side}</div>}
    </section>
  );
}

function HeroStat({ value, label }) {
  return (
    <span className="acc-hero__stat">
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}

const ACTIVE_STATUSES = ['New', 'Confirmed', 'AwaitingLayoutApproval', 'InProduction', 'ReadyForDelivery'];
const COUNT_PAGE = 100;

function MyOrders() {
  const [page, setPage] = useState(1);
  const orders = useAsync(() => ordersApi.mine({ page, pageSize: 10 }), [page]);
  // «В работе» считаем по всем заказам, а не по текущей странице списка — отдельный запрос один раз.
  const summary = useAsync(() => ordersApi.mine({ page: 1, pageSize: COUNT_PAGE }), []);
  const data = orders.data;
  const all = summary.data;
  const activeCount = all?.items?.filter((o) => ACTIVE_STATUSES.includes(o.status)).length ?? null;
  // Если заказов больше, чем вместилось в запрос, честно показываем «N+».
  const active = activeCount == null ? null : all.totalCount > all.items.length ? `${activeCount}+` : activeCount;
  return (
    <div className="acc-section">
      <AccHero
        id="acc-orders-title"
        title="Мои заказы"
        lead="Статус каждого заказа, фото и детали. Пока заказ новый — его можно изменить."
        icon={ICONS.bag}
        side={
          data && data.totalCount > 0 ? (
            <>
              <HeroStat value={data.totalCount} label="всего" />
              {active != null && <HeroStat value={active} label="в работе" />}
            </>
          ) : null
        }
      />
      <Async
        state={orders}
        empty={
          <Empty title="Заказов пока нет" action={<Link to="/catalog" className="btn btn--primary">Перейти в каталог</Link>}>
            Оформленные заказы появятся здесь.
          </Empty>
        }
      >
        {(data) => (
          <>
          <ul className="acc-orders">
            {data.items.map((o) => (
              <li key={o.id}>
                <Link to={`/account/orders/${o.id}`} className={`acc-order acc-order--${o.status}`}>
                  <span className="acc-order__icon" aria-hidden="true">{ICONS.box}</span>
                  <span className="acc-order__main">
                    <span className="acc-order__num">Заказ {o.orderNumber}</span>
                    <span className="acc-order__date">{date(o.createdAt)}</span>
                  </span>
                  <span className="acc-order__status">
                    <OrderStatusBadge status={o.status} />
                  </span>
                  <span className="acc-order__sum">{money(o.payableAmount)}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </>
        )}
      </Async>
    </div>
  );
}

// Путь заказа для клиента (ORDER_FLOW из lib/format.js); отменённый заказ показываем без шкалы.
// Шаг «Согласование макета» необязательный: показываем его, только если заказ сейчас на нём
// или уже прошёл его (по заказу были макеты).
function OrderTrack({ status, hadLayouts }) {
  const layoutAt = ORDER_FLOW.indexOf('AwaitingLayoutApproval');
  const at = ORDER_FLOW.indexOf(status);
  if (at < 0) return null;
  const showLayout = status === 'AwaitingLayoutApproval' || (at > layoutAt && hadLayouts);
  const flow = showLayout ? ORDER_FLOW : ORDER_FLOW.filter((s) => s !== 'AwaitingLayoutApproval');
  const current = flow.indexOf(status);
  return (
    <ol className="acc-track" aria-label="Этапы заказа">
      {flow.map((s, i) => (
        <li
          key={s}
          className={i < current ? 'is-done' : i === current ? 'is-current' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="acc-track__dot" aria-hidden="true" />
          <span className="acc-track__label">{ORDER_STATUS[s]}</span>
        </li>
      ))}
    </ol>
  );
}

function MyOrder() {
  const { id } = useParams();
  const order = useAsync(() => ordersApi.mineGet(id), [id]);
  const layouts = useAsync(() => layoutsApi.mine(id), [id]);
  // После ответа по макету статус заказа может смениться (одобрен → «В производстве») — обновляем оба.
  const reloadAll = () => {
    order.reload();
    layouts.reload();
  };
  return (
    <Async state={order}>
      {(o) => {
        // Фото и кадр — пока заказ «Новый»/«Подтверждён» (правило сервера).
        const canEditPreview = o.status === 'New' || o.status === 'Confirmed';
        // Состав (количество, товары, удаление фото) — только пока заказ не оплачен и нет чека на проверке (C6).
        const canEditItems = canEditPreview && (o.canCustomerEdit ?? true);
        const layoutList = layouts.data ?? [];
        const awaitingLayout = o.status === 'AwaitingLayoutApproval';
        const lockedByManager = !canEditItems && (canEditPreview || awaitingLayout);
        return (
          <div className="acc-section acc-detail">
            <Link to="/account" className="acc-back">
              <Chevron dir="left" />
              Все заказы
            </Link>

            <AccHero
              id="acc-order-title"
              title={`Заказ ${o.orderNumber}`}
              lead={`Оформлен ${dateTime(o.createdAt)}`}
              icon={ICONS.box}
              side={<HeroStat value={money(o.payableAmount)} label="к оплате" />}
            >
              <div className="badges acc-hero__badges">
                <OrderStatusBadge status={o.status} />
                <PaymentStatusBadge status={o.paymentStatus} />
              </div>
            </AccHero>

            {/* Ждём ответа клиента по макету — ставим наверх, чтобы не потерялось */}
            {awaitingLayout && (
              <LayoutApproval order={o} state={layouts} onChanged={reloadAll} highlight />
            )}

            {/* Дата оформления и сумма уже в шапке — здесь только этапы, оплата и адрес */}
            <section className="acc-card" aria-labelledby="acc-facts-title">
              <header className="acc-prof__head">
                <span className="acc-prof__icon acc-prof__icon--lilac" aria-hidden="true">
                  {ICONS.receipt}
                </span>
                <h3 id="acc-facts-title">Детали заказа</h3>
              </header>
              <OrderTrack status={o.status} hadLayouts={layoutList.length > 0} />
              <dl className="acc-facts">
                <div>
                  <dt>Оплата</dt>
                  <dd>{PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod}</dd>
                </div>
                <div>
                  <dt>Адрес</dt>
                  <dd>{o.deliveryAddress || 'Самовывоз'}</dd>
                </div>
              </dl>
            </section>

            <PaymentBox order={o} onChanged={order.reload} />

            {!awaitingLayout && layoutList.length > 0 && <LayoutApproval order={o} state={layouts} onChanged={reloadAll} />}

            <section className="acc-card" aria-labelledby="acc-items-title">
              <header className="acc-prof__head">
                <span className="acc-prof__icon acc-prof__icon--lemon" aria-hidden="true">
                  {ICONS.photo}
                </span>
                <h3 id="acc-items-title">Товары и фото</h3>
              </header>
              {canEditItems ? (
                <p className="acc-note">
                  Пока заказ «{ORDER_STATUS[o.status]}», его можно менять: добавить товары, изменить количество,
                  загрузить или удалить фото и нажать «Кадр». Менеджер увидит ваши изменения.
                </p>
              ) : lockedByManager ? (
                <div className="acc-note acc-note--locked">
                  <p>
                    {Number(o.paidAmount ?? 0) > 0
                      ? 'Заказ оплачен — изменить состав можно через менеджера.'
                      : awaitingLayout
                        ? 'Заказ на согласовании макета — изменить состав можно через менеджера.'
                        : 'Чек об оплате на проверке — изменить состав можно через менеджера.'}
                    {canEditPreview && ' Загрузить недостающие фото и выбрать кадр можно и сейчас.'}
                  </p>
                  <button type="button" className="btn btn--primary btn--small" onClick={openChat}>
                    Написать менеджеру
                  </button>
                </div>
              ) : (
                o.status !== 'Cancelled' && (
                  <div className="acc-note acc-note--locked">
                    <p>
                      Заказ уже в работе, поэтому изменить его нельзя. Чтобы добавить фото или товары, оформите новый
                      заказ — он придёт к нам отдельно.
                    </p>
                    <Link to="/catalog" className="btn btn--primary btn--small">
                      Оформить новый заказ
                    </Link>
                  </div>
                )
              )}
              <MyOrderItems order={o} editable={canEditItems} canPhotos={canEditPreview} onChanged={order.reload} />
            </section>
          </div>
        );
      }}
    </Async>
  );
}

/** «Макет на согласование» (C2): клиент одобряет макет или просит правки с комментарием. */
function LayoutApproval({ order: o, state, onChanged, highlight = false }) {
  const toast = useToast();
  const [zoom, setZoom] = useState(null);
  const [changing, setChanging] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const list = state.data ?? [];
  const canAnswer = o.status === 'AwaitingLayoutApproval';

  const approve = async (l) => {
    setBusy(true);
    setError(null);
    try {
      await layoutsApi.approve(o.id, l.id);
      toast('Макет одобрен — спасибо! Передаём заказ в производство.');
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const sendChanges = async (e) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return setError({ messages: ['Опишите, что нужно поправить в макете.'] });
    setBusy(true);
    setError(null);
    try {
      await layoutsApi.requestChanges(o.id, changing.id, text);
      toast('Правки отправлены менеджеру');
      setChanging(null);
      setComment('');
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`acc-card acc-layouts${highlight ? ' acc-layouts--attention' : ''}`} aria-labelledby="acc-layouts-title">
      <header className="acc-prof__head">
        <span className="acc-prof__icon acc-prof__icon--lilac" aria-hidden="true">
          {ICONS.photo}
        </span>
        <h3 id="acc-layouts-title">Макет на согласование</h3>
      </header>
      {highlight && (
        <p className="acc-layouts__lead">
          Менеджер подготовил макет. Посмотрите его и одобрите — или напишите, что поправить. Производство начнётся после
          вашего одобрения.
        </p>
      )}
      {state.loading && !state.data ? (
        <p className="muted">Загружаем макеты…</p>
      ) : state.error ? (
        <ErrorBox error={state.error} onRetry={state.reload} />
      ) : !list.length ? (
        <p className="muted">Макет ещё готовится — мы пришлём уведомление, когда он появится.</p>
      ) : (
        <ul className="acc-layouts__list">
          {list.map((l) => (
            <li key={l.id} className={`acc-layout acc-layout--${l.status}`}>
              <button
                type="button"
                className="acc-layout__img"
                aria-label="Открыть макет в полном размере"
                onClick={() => setZoom({ src: assetUrl(l.imageUrl), title: `Макет от ${dateTime(l.createdAt)}` })}
              >
                <Img src={l.imageUrl} alt="Макет" />
              </button>
              <div className="acc-layout__info">
                <span className={`acc-layout__status acc-layout__status--${l.status}`}>{LAYOUT_STATUS[l.status] || l.status}</span>
                <span className="acc-layout__date">{dateTime(l.createdAt)}</span>
                {l.note && <p className="acc-layout__note">{l.note}</p>}
                {l.customerComment && (
                  <p className="acc-layout__comment">
                    <b>Ваш комментарий:</b> {l.customerComment}
                  </p>
                )}
                {canAnswer && l.status === 'Pending' && (
                  <div className="acc-layout__actions">
                    <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => approve(l)}>
                      Одобрить макет
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setComment('');
                        setChanging(l);
                      }}
                    >
                      Нужны правки
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!changing && <ErrorBox error={error} />}

      {changing && (
        <Modal title="Что поправить в макете?" onClose={() => !busy && setChanging(null)}>
          <form onSubmit={sendChanges} className="acc-form">
            <Textarea
              label="Комментарий для менеджера"
              required
              maxLength={1000}
              placeholder="Например: сделать фон светлее, сдвинуть лицо в центр"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <ErrorBox error={error} />
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setChanging(null)} disabled={busy}>
                Отмена
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy || !comment.trim()}>
                {busy ? 'Отправляем…' : 'Отправить правки'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {zoom && <PhotoZoom src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} />}
    </section>
  );
}

// canEditPreview — кадрирование и макет (только в кабинете клиента; сервер разрешает их для статусов New/Confirmed).
// Компонент также используется в админке (pages/admin/Orders.jsx): разметка и классы общие,
// новый вид кабинета задаётся только внутри .acc-page (styles/site/account.css).
/** Состав заказа в кабинете: пока заказ «Новый»/«Подтверждён», клиент меняет количество, добавляет и убирает товары. */
// editable — менять состав (C6: CanCustomerEdit); canPhotos — загружать фото и выбирать кадр (New/Confirmed).
function MyOrderItems({ order: o, editable, canPhotos = editable, onChanged }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn, msg) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast(msg);
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ErrorBox error={error} />
      <ul className="acc-items">
        {o.items.map((item) => (
          <li key={item.id}>
            {/* Фото и кадр — в статусах New/Confirmed; удалять фото и менять состав — только пока заказ не оплачен (как на сервере) */}
            <OrderItemPhotos item={item} editable={canPhotos} canEditPreview={canPhotos} canDelete={editable}>
              {({ copiesTotal }) =>
                editable ? (
                  <div className="acc-item-edit">
                    {/* fieldset disabled блокирует кнопки степпера, пока идёт запрос */}
                    <fieldset className="acc-item-edit__qty" disabled={busy}>
                      <Stepper
                        value={item.quantity}
                        min={Math.max(1, copiesTotal)}
                        onChange={(q) => {
                          if (busy || q === item.quantity) return;
                          run(() => ordersApi.updateMyItem(o.id, item.id, q), 'Количество изменено');
                        }}
                      />
                    </fieldset>
                    {item.quantity > 1 && item.quantity <= copiesTotal && (
                      <small className="acc-item-edit__hint">
                        Количество не меньше суммы стикеров по фото. Чтобы уменьшить его, сначала уменьшите число стикеров у
                        фото или удалите лишние фото.
                      </small>
                    )}
                    {o.items.length > 1 && (
                      <button type="button" className="btn btn--quiet btn--small" disabled={busy} onClick={() => setRemoving(item)}>
                        Убрать из заказа
                      </button>
                    )}
                  </div>
                ) : (
                  o.status !== 'Cancelled' &&
                  item.productId && (
                    <Link to={`/product/${item.productId}`} className="text-link acc-reorder">
                      Заказать снова
                    </Link>
                  )
                )
              }
            </OrderItemPhotos>
          </li>
        ))}
      </ul>

      {editable && (
        <button type="button" className="btn btn--ghost acc-add-item" onClick={() => setAdding(true)}>
          + Добавить товар в этот заказ
        </button>
      )}

      {adding && (
        <VariantPicker
          title="Добавить товар в заказ"
          onClose={() => setAdding(false)}
          onPick={async (variantId, qty) => {
            await ordersApi.addMyItem(o.id, variantId, qty);
            setAdding(false);
            toast('Товар добавлен в заказ. Загрузите к нему фото, если оно нужно.');
            onChanged();
          }}
        />
      )}

      {removing && (
        <Modal title="Убрать товар из заказа?" onClose={() => !busy && setRemoving(null)}>
          <p className="acc-confirm-text">
            «{productName(removing)}» × {removing.quantity} пропадёт из заказа вместе с его фото. Сумма заказа пересчитается.
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setRemoving(null)} disabled={busy}>
              Оставить
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              onClick={async () => {
                const item = removing;
                setRemoving(null);
                await run(() => ordersApi.removeMyItem(o.id, item.id), 'Товар убран из заказа');
              }}
            >
              Убрать
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** «Стикеров с этого фото: − N +» в окне макета: каждое нажатие сразу сохраняется на сервере. */
function PhotoCopiesControl({ photo, max, onSaved }) {
  const [value, setValue] = useState(() => photoCopies(photo));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const change = async (n) => {
    if (busy || n === value) return;
    const prev = value;
    setValue(n);
    setBusy(true);
    setError(null);
    try {
      await orderPhotosApi.updateCopies(photo.id, n);
      onSaved?.(n);
    } catch (e) {
      setValue(prev);
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-view__copies">
      <span>Стикеров с этого фото:</span>
      <fieldset className="photo-view__copies-step" disabled={busy}>
        <Stepper value={value} min={1} max={Math.max(max, value)} onChange={change} label="Стикеров с этого фото" />
      </fieldset>
      {value >= max && (
        <small className="acc-item-edit__hint">Чтобы добавить стикеров с этого фото, сначала увеличьте количество товара.</small>
      )}
      <ErrorBox error={error} />
    </div>
  );
}

// deleteNote — дополнительное предупреждение в окне удаления (админка: фото прислал клиент).
// canUpload — можно ли добавлять фото: только клиент-владелец, в админке выключено (сервер тоже не даст).
// canDelete — можно ли удалять фото (у клиента — только пока заказ не оплачен, C6).
// children — разметка или функция ({ photoCount, copiesTotal }) => разметка (кабинет: нижняя граница количества).
// У каждого фото copies — сколько стикеров с него напечатать; сумма копий не больше количества позиции (проверяет сервер).
export function OrderItemPhotos({
  item,
  editable = true,
  canEditPreview = false,
  canUpload = editable,
  canDelete = editable,
  deleteNote,
  children,
}) {
  const photos = useAsync(() => orderPhotosApi.list(item.id), [item.id]);
  // Формы стикера (круг/квадрат/сердце) — из вариантов этого товара; у товаров без формы список пуст.
  const shapes = useAsync(
    () =>
      item.productId
        ? variantsApi.list({ productId: item.productId, pageSize: 100 }).then((r) => shapesFromVariants(r.items, parseJson))
        : Promise.resolve([]),
    [item.productId],
  );
  const shapeList = shapes.data ?? [];
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  // Исходное фото / макет на весь экран — поверх окна «Макет стикера»
  const [zoom, setZoom] = useState(null);
  useEffect(() => {
    if (!viewing) setZoom(null);
  }, [viewing]);
  const [confirming, setConfirming] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Файлы, которые не загрузились: [{ name, reason }]
  const [failed, setFailed] = useState([]);

  // Загружаем по одному: список обновляется после каждого файла, ошибка одного не останавливает остальные.
  const upload = async (files) => {
    setBusy(true);
    setError(null);
    setFailed([]);
    const bad = [];
    let first = null;
    try {
      for (const f of files) {
        const problem = photoProblem(f);
        if (problem) {
          bad.push({ name: f.name, reason: problem });
          continue;
        }
        try {
          const saved = await orderPhotosApi.upload(item.id, f);
          first ??= saved;
          photos.reload();
        } catch (e) {
          bad.push({ name: f.name, reason: e?.messages?.join(' ') || e?.message || 'ошибка загрузки' });
        }
      }
      setFailed(bad);
      // Сразу предлагаем выбрать форму и кадр для первого нового фото.
      if (canEditPreview && shapeList.length && first) setEditing(first);
    } finally {
      setBusy(false);
    }
  };
  // Удаление только после подтверждения в окне — фото нельзя вернуть, только загрузить заново.
  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await orderPhotosApi.remove(confirming.id);
      setConfirming(null);
      photos.reload();
    } catch (e) {
      setError(e);
      setConfirming(null);
    } finally {
      setRemoving(false);
    }
  };

  const list = (photos.data ?? []).filter((p) => !p.isDeleted);
  const copiesTotal = sumCopies(list);
  // Потолок копий для фото: штуки позиции, не занятые другими фото.
  const maxCopiesFor = (p) => Math.max(1, item.quantity - (copiesTotal - photoCopies(p)));
  return (
    <div className="order-item">
      <div className="order-item__top">
        <strong>{productName(item)}</strong>
        <span className="muted">
          {item.quantity} × {money(item.unitPrice)}
        </span>
        <span>{money(item.subTotal)}</span>
      </div>
      <div className="thumbs">
        {list.map((p) => (
          <figure key={p.id} className="thumb">
            {/* Открываем макет (фото в выбранной форме и размере), а не исходник */}
            <button type="button" className="thumb__open" aria-label="Посмотреть макет" onClick={() => setViewing(p)}>
              <Img src={p.editedPreviewUrl || p.originalPhotoUrl} alt="Фото к товару" />
            </button>
            <span className="thumb__copies" title="Стикеров с этого фото">
              ×{photoCopies(p)}
            </span>
            {(() => {
              const chosen = parseJson(p.cropDataJson, null)?.shape;
              if (chosen) return <figcaption>{SHAPE_LABEL[chosen] || 'Макет'}</figcaption>;
              if (shapeList.length) return <figcaption className="thumb__need-shape">Выберите форму</figcaption>;
              return p.editedPreviewUrl ? <figcaption>Макет</figcaption> : null;
            })()}
            {canEditPreview && (
              <button
                type="button"
                className="thumb__edit"
                aria-label={p.editedPreviewUrl ? 'Изменить кадр' : 'Кадрировать фото'}
                onClick={() => setEditing(p)}
              >
                Кадр
              </button>
            )}
            {canDelete && (
              <button type="button" className="thumb__del" aria-label="Удалить фото" title="Удалить фото" onClick={() => setConfirming(p)}>
                ×
              </button>
            )}
          </figure>
        ))}
        {editable && canUpload && (
          <label className="thumb thumb--add">
            <span aria-hidden="true">{busy ? '…' : '+'}</span>
            <input type="file" aria-label="Добавить фото" className="sr-only" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {typeof children === 'function' ? children({ photoCount: list.length, copiesTotal }) : children}
      {failed.length > 0 && (
        <div className="error-box acc-upload-failed" role="alert">
          <p>Не удалось загрузить:</p>
          <ul>
            {failed.map((f, i) => (
              <li key={i}>
                <b>{f.name}</b> — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ErrorBox error={error || photos.error} onRetry={photos.error ? photos.reload : undefined} />
      {editing && (
        <PhotoEditor
          photo={editing}
          shapes={shapeList}
          copies={photoCopies(editing)}
          maxCopies={maxCopiesFor(editing)}
          onClose={() => setEditing(null)}
          onSaved={photos.reload}
        />
      )}
      {viewing && (
        <Modal title="Макет стикера" onClose={() => setViewing(null)} wide>
          {(() => {
            const chosen = parseJson(viewing.cropDataJson, null)?.shape;
            return (
              <div className="photo-view">
                <button
                  type="button"
                  className="photo-view__stage photo-view__stage--zoom"
                  aria-label="Открыть в полном размере"
                  onClick={() =>
                    setZoom(
                      viewing.editedPreviewUrl
                        ? { src: assetUrl(viewing.editedPreviewUrl), title: 'Макет в полном размере' }
                        : { src: assetUrl(viewing.originalPhotoUrl), title: 'Исходное фото' },
                    )
                  }
                >
                  <Img src={viewing.editedPreviewUrl || viewing.originalPhotoUrl} alt="Макет" />
                </button>
                <p className="photo-view__meta">
                  {viewing.editedPreviewUrl
                    ? `Так фото будет напечатано${chosen ? ` — форма «${SHAPE_LABEL[chosen]}»` : ''}.`
                    : 'Кадр ещё не выбран — показано исходное фото.'}
                </p>
                {canEditPreview ? (
                  <PhotoCopiesControl
                    key={viewing.id}
                    photo={viewing}
                    max={maxCopiesFor(viewing)}
                    onSaved={(copies) => {
                      setViewing((v) => (v && v.id === viewing.id ? { ...v, copies } : v));
                      photos.reload();
                    }}
                  />
                ) : (
                  <p className="photo-view__copies">
                    Стикеров с этого фото: <b>{photoCopies(viewing)}</b>
                  </p>
                )}
                <div className="form-actions photo-view__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => setZoom({ src: assetUrl(viewing.originalPhotoUrl), title: 'Исходное фото' })}
                  >
                    Исходное фото
                  </button>
                  {viewing.editedPreviewUrl && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => setZoom({ src: assetUrl(viewing.editedPreviewUrl), title: 'Макет в полном размере' })}
                    >
                      Макет в полном размере
                    </button>
                  )}
                  {canEditPreview && (
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => {
                        setEditing(viewing);
                        setViewing(null);
                      }}
                    >
                      Изменить кадр
                    </button>
                  )}
                </div>
                {zoom && <PhotoZoom src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} />}
              </div>
            );
          })()}
        </Modal>
      )}
      {confirming && (
        <Modal title="Удалить фото?" onClose={() => !removing && setConfirming(null)}>
          <div className="photo-confirm">
            <Img src={confirming.editedPreviewUrl || confirming.originalPhotoUrl} alt="" className="photo-confirm__img" />
            <div className="photo-confirm__text">
              {deleteNote && <p className="photo-confirm__note">{deleteNote}</p>}
              <p>Фото исчезнет из заказа «{productName(item)}». Вернуть его будет нельзя — только загрузить заново.</p>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(null)} disabled={removing}>
              Оставить фото
            </button>
            <button type="button" className="btn btn--danger" onClick={remove} disabled={removing}>
              {removing ? 'Удаляем…' : 'Удалить фото'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MyCoins() {
  const { profile, refreshProfile } = useAuth();
  const [page, setPage] = useState(1);
  const history = useAsync(() => profileApi.coins({ page, pageSize: 20 }), [page]);

  useEffect(() => {
    refreshProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const balance = profile?.coinsBalance ?? 0;
  return (
    <div className="acc-section">
      <AccHero
        id="acc-coins-title"
        title="Мои монеты"
        lead="1 монета = 1 сомони. Списать монеты можно при оформлении заказа."
        icon={ICONS.coin}
        tone="lemon"
        side={<HeroStat value={balance} label={`${coinsWord(balance)} на счету`} />}
      />

      <section className="acc-card" aria-labelledby="acc-ledger-title">
        <header className="acc-prof__head">
          <span className="acc-prof__icon acc-prof__icon--lilac" aria-hidden="true">
            {ICONS.clock}
          </span>
          <h3 id="acc-ledger-title">История операций</h3>
        </header>
        <Async state={history} empty={<Empty title="Операций пока нет">Начисления и списания монет появятся здесь.</Empty>}>
          {(data) => (
            <>
              <ul className="acc-ledger">
                {data.items.map((t) => (
                  <li key={t.id} className="acc-ledger__row">
                    <span className="acc-ledger__what">
                      <span className="acc-ledger__type">{COIN_TYPE[t.type] || t.type}</span>
                      {t.description && <span className="acc-ledger__desc">{t.description}</span>}
                      <span className="acc-ledger__date">{dateTime(t.createdAt)}</span>
                    </span>
                    {/* Amount хранится со знаком: списания отрицательные */}
                    <span className={`acc-ledger__amount ${t.amount < 0 ? 'is-minus' : 'is-plus'}`}>
                      {t.amount > 0 ? `+${t.amount}` : `−${Math.abs(t.amount)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </>
          )}
        </Async>
      </section>
    </div>
  );
}

function ProfileForm() {
  const { profile, setProfile, refreshProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: '', bio: '', phoneNumber: '', deliveryCityId: '', deliveryAddress: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const cities = useAsync(() => citiesApi.list({ isActive: true, pageSize: 100 }), []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Заполняем форму один раз: refreshProfile() после загрузки аватара не должен стирать ввод.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (profile && !filled) {
      setForm({
        fullName: profile.fullName || '',
        bio: profile.bio || '',
        phoneNumber: profile.phoneNumber || '',
        deliveryCityId: profile.deliveryCityId || '',
        deliveryAddress: profile.deliveryAddress || '',
      });
      setFilled(true);
    }
  }, [profile, filled]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await profileApi.update({
        ...form,
        phoneNumber: form.phoneNumber.trim() || null,
        deliveryCityId: form.deliveryCityId || null,
        deliveryAddress: form.deliveryAddress.trim() || null,
        avatarUrl: profile?.avatarUrl ?? null,
      });
      setProfile(updated);
      toast('Профиль сохранён');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Сколько полей для заказа заполнено — показываем прогресс в шапке профиля.
  const orderFields = [form.fullName.trim(), form.phoneNumber.trim(), form.deliveryCityId || form.deliveryAddress.trim()];
  const doneCount = orderFields.filter(Boolean).length;

  return (
    <div className="acc-section">
      <AccHero
        id="acc-profile-title"
        title="Профиль"
        lead="Заполните данные один раз — при оформлении заказа они подставятся сами."
        media={
          <div className="acc-prof__avatar">
            <ImageUpload
              label="Фото профиля"
              current={profile?.avatarUrl}
              onUpload={async (file) => {
                await profileApi.uploadAvatar(file);
                await refreshProfile();
                toast('Фото обновлено');
              }}
            />
          </div>
        }
      >
        <div className="acc-prof__progress">
          <span
            className="acc-prof__bar"
            role="progressbar"
            aria-label="Заполненность профиля для заказа"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={doneCount}
            aria-valuetext={`Заполнено ${doneCount} из 3`}
          >
            <span style={{ width: `${(doneCount / 3) * 100}%` }} />
          </span>
          <span className="acc-prof__count" aria-hidden="true">
            {doneCount === 3 ? 'Готово к быстрому заказу' : `Заполнено ${doneCount} из 3`}
          </span>
        </div>
      </AccHero>

    <form className="acc-form acc-prof" onSubmit={submit} aria-labelledby="acc-profile-title">
      <div className="acc-prof__grid">
        <section className="acc-card" aria-labelledby="acc-prof-personal">
          <header className="acc-prof__head">
            <span className="acc-prof__icon acc-prof__icon--lilac" aria-hidden="true">
              {ICONS.user}
            </span>
            <h3 id="acc-prof-personal">Личные данные</h3>
          </header>
          <Input label="Имя и фамилия" maxLength={100} autoComplete="name" value={form.fullName} onChange={set('fullName')} />
          <Textarea label="О себе" hint="Необязательно" maxLength={500} value={form.bio} onChange={set('bio')} />
        </section>

        <section className="acc-card acc-card--accent" aria-labelledby="acc-prof-order">
          <header className="acc-prof__head">
            <span className="acc-prof__icon acc-prof__icon--lemon" aria-hidden="true">
              {ICONS.truck}
            </span>
            <h3 id="acc-prof-order">Для оформления заказа</h3>
          </header>
          <Input
            label="Телефон"
            type="tel"
            inputMode="tel"
            maxLength={30}
            placeholder="+992 90 000 00 00"
            autoComplete="tel"
            value={form.phoneNumber}
            onChange={set('phoneNumber')}
          />
          <Select
            label="Город доставки"
            placeholder="Самовывоз"
            hint={cities.loading && !cities.data ? 'Загружаем города…' : undefined}
            value={form.deliveryCityId}
            onChange={set('deliveryCityId')}
            options={(cities.data?.items ?? []).map((c) => ({ value: c.id, label: nameOf(c) }))}
          />
          <Textarea
            label="Адрес доставки"
            maxLength={300}
            placeholder="Улица, дом, квартира"
            autoComplete="street-address"
            value={form.deliveryAddress}
            onChange={set('deliveryAddress')}
          />
        </section>
      </div>

      <ErrorBox error={error} />
      <div className="acc-prof__actions">
        <button className="btn btn--primary acc-form__submit" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
      </div>
    </form>
    </div>
  );
}

function PasswordForm() {
  const toast = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const problems = form.newPassword ? passwordProblems(form.newPassword) : [];

  const submit = async (e) => {
    e.preventDefault();
    if (problems.length) return setError({ messages: [`Пароль: не хватает — ${problems.join(', ')}.`] });
    if (form.newPassword !== form.confirmPassword) return setError({ messages: ['Пароли не совпадают.'] });
    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword(form);
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      // Сервер обновил security stamp — текущий токен больше не действует: выходим и просим войти заново.
      toast('Пароль изменён — войдите заново');
      logout();
      navigate('/login', { replace: true, state: { from: '/account' } });
      return;
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acc-section">
      <AccHero
        id="acc-password-title"
        title="Смена пароля"
        lead="Новый пароль начнёт действовать сразу: после смены войдите заново. Старый больше не подойдёт."
        icon={ICONS.lock}
        tone="cherry"
      />
      <div className="acc-prof__grid">
    <form className="acc-card acc-form" onSubmit={submit} aria-label="Смена пароля">
      <header className="acc-prof__head">
        <span className="acc-prof__icon acc-prof__icon--lilac" aria-hidden="true">
          {ICONS.lock}
        </span>
        <h3>Новый пароль</h3>
      </header>
      <Input label="Текущий пароль" type="password" required autoComplete="current-password" value={form.oldPassword} onChange={set('oldPassword')} />
      <div className="acc-form__pw">
        <Input
          label="Новый пароль"
          type="password"
          required
          autoComplete="new-password"
          hint={form.newPassword ? null : PASSWORD_HINT}
          aria-describedby={form.newPassword ? 'acc-pw-rules' : undefined}
          aria-invalid={problems.length ? true : undefined}
          value={form.newPassword}
          onChange={set('newPassword')}
        />
        <PasswordRules password={form.newPassword} id="acc-pw-rules" />
      </div>
      <Input
        label="Повторите новый пароль"
        type="password"
        required
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={set('confirmPassword')}
        error={form.confirmPassword && form.confirmPassword !== form.newPassword ? 'Пароли не совпадают' : null}
      />
      <ErrorBox error={error} />
      <button className="btn btn--primary acc-form__submit" disabled={busy}>
        {busy ? 'Сохраняем…' : 'Изменить пароль'}
      </button>
    </form>
        <aside className="acc-card acc-card--accent acc-pw-tips">
          <header className="acc-prof__head">
            <span className="acc-prof__icon acc-prof__icon--lemon" aria-hidden="true">
              {ICONS.shield}
            </span>
            <h3>Как выбрать надёжный пароль</h3>
          </header>
          <ul>
            <li>Не используйте пароль от почты или соцсетей.</li>
            <li>Смешайте заглавные и строчные буквы, цифры и символы.</li>
            <li>Фраза из нескольких слов запоминается легче и надёжнее.</li>
            <li>Никому не сообщайте пароль — менеджеры его не спрашивают.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
