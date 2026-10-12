import '../../styles/site/account.css';
import { useEffect, useState } from 'react';
import { Link, NavLink, Routes, useLocation, useParams } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authApi, citiesApi, orderPhotosApi, ordersApi, profileApi, variantsApi } from '../../api/endpoints.js';
import { SHAPE_LABEL, shapesFromVariants } from '../../lib/shapes.js';
import { assetUrl } from '../../api/client.js';
import { COIN_TYPE, date, dateTime, money, nameOf, ORDER_STATUS, parseJson, PAYMENT_METHOD } from '../../lib/format.js';
import PhotoEditor from '../../components/PhotoEditor.jsx';
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
};

/** Цветная шапка раздела кабинета: иконка, заголовок, пояснение и (необязательно) цифры справа. */
function AccHero({ id, title, lead, icon, tone = 'cobalt', side, children }) {
  return (
    <section className={`acc-prof__hero acc-hero acc-hero--${tone}`} aria-labelledby={id}>
      <span className="acc-hero__icon">{icon}</span>
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

const ACTIVE_STATUSES = ['New', 'Confirmed', 'InProduction', 'ReadyForDelivery'];

function MyOrders() {
  const [page, setPage] = useState(1);
  const orders = useAsync(() => ordersApi.mine({ page, pageSize: 10 }), [page]);
  const data = orders.data;
  const active = data?.items?.filter((o) => ACTIVE_STATUSES.includes(o.status)).length ?? 0;
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
              <HeroStat value={active} label="в работе" />
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

// Путь заказа для клиента; отменённый заказ показываем без шкалы
const ORDER_FLOW = ['New', 'Confirmed', 'InProduction', 'ReadyForDelivery', 'Delivered'];

function OrderTrack({ status }) {
  const current = ORDER_FLOW.indexOf(status);
  if (current < 0) return null;
  return (
    <ol className="acc-track" aria-label="Этапы заказа">
      {ORDER_FLOW.map((s, i) => (
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
  return (
    <Async state={order}>
      {(o) => {
        const canEditPreview = o.status === 'New' || o.status === 'Confirmed';
        return (
          <div className="acc-detail">
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

            <div className="acc-card">
              <OrderTrack status={o.status} />
            </div>

            <dl className="acc-facts">
              <div>
                <dt>Создан</dt>
                <dd>{dateTime(o.createdAt)}</dd>
              </div>
              <div>
                <dt>Оплата</dt>
                <dd>{PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod}</dd>
              </div>
              <div className="acc-facts__wide">
                <dt>Адрес</dt>
                <dd>{o.deliveryAddress || 'Самовывоз'}</dd>
              </div>
              <div className="acc-facts__total">
                <dt>К оплате</dt>
                <dd>{money(o.payableAmount)}</dd>
              </div>
            </dl>

            <section aria-labelledby="acc-items-title" className="acc-items-wrap">
              <h3 id="acc-items-title" className="acc-h3">
                Товары и фото
              </h3>
              {canEditPreview ? (
                <p className="acc-note">
                  Пока заказ «{ORDER_STATUS[o.status]}», его можно менять: добавить товары, изменить количество,
                  загрузить или удалить фото и нажать «Кадр». Менеджер увидит ваши изменения.
                </p>
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
              <MyOrderItems order={o} editable={canEditPreview} onChanged={order.reload} />
            </section>
          </div>
        );
      }}
    </Async>
  );
}

// canEditPreview — кадрирование и макет (только в кабинете клиента; сервер разрешает их для статусов New/Confirmed).
// Компонент также используется в админке (pages/admin/Orders.jsx): разметка и классы общие,
// новый вид кабинета задаётся только внутри .acc-page (styles/site/account.css).
/** Состав заказа в кабинете: пока заказ «Новый»/«Подтверждён», клиент меняет количество, добавляет и убирает товары. */
function MyOrderItems({ order: o, editable, onChanged }) {
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
            {/* Менять фото и состав можно только в статусах New/Confirmed — так же проверяет сервер */}
            <OrderItemPhotos item={item} editable={editable} canEditPreview={editable}>
              {editable ? (
                <div className="acc-item-edit">
                  <Stepper
                    value={item.quantity}
                    onChange={(q) => run(() => ordersApi.updateMyItem(o.id, item.id, q), 'Количество изменено')}
                  />
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
              )}
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
            «{removing.productNameEn}» × {removing.quantity} пропадёт из заказа вместе с его фото. Сумма заказа пересчитается.
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

// deleteNote — дополнительное предупреждение в окне удаления (админка: фото прислал клиент).
// canUpload — можно ли добавлять фото: только клиент-владелец, в админке выключено (сервер тоже не даст).
export function OrderItemPhotos({ item, editable = true, canEditPreview = false, canUpload = editable, deleteNote, children }) {
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
  const [confirming, setConfirming] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (files) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = [];
      for (const f of files) uploaded.push(await orderPhotosApi.upload(item.id, f));
      photos.reload();
      // Сразу предлагаем выбрать форму и кадр для первого нового фото.
      if (canEditPreview && shapeList.length && uploaded[0]) setEditing(uploaded[0]);
    } catch (e) {
      setError(e);
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
  return (
    <div className="order-item">
      <div className="order-item__top">
        <strong>{item.productNameEn}</strong>
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
            {editable && (
              <button type="button" aria-label="Удалить фото" title="Удалить фото" onClick={() => setConfirming(p)}>
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
      {children}
      <ErrorBox error={error || photos.error} />
      {editing && <PhotoEditor photo={editing} shapes={shapeList} onClose={() => setEditing(null)} onSaved={photos.reload} />}
      {viewing && (
        <Modal title="Макет стикера" onClose={() => setViewing(null)} wide>
          {(() => {
            const chosen = parseJson(viewing.cropDataJson, null)?.shape;
            return (
              <div className="photo-view">
                <div className="photo-view__stage">
                  <Img src={viewing.editedPreviewUrl || viewing.originalPhotoUrl} alt="Макет" />
                </div>
                <p className="photo-view__meta">
                  {viewing.editedPreviewUrl
                    ? `Так фото будет напечатано${chosen ? ` — форма «${SHAPE_LABEL[chosen]}»` : ''}.`
                    : 'Кадр ещё не выбран — показано исходное фото.'}
                </p>
                <div className="form-actions photo-view__actions">
                  <a href={assetUrl(viewing.originalPhotoUrl)} target="_blank" rel="noreferrer" className="btn btn--ghost btn--small">
                    Исходное фото
                  </a>
                  {viewing.editedPreviewUrl && (
                    <a href={assetUrl(viewing.editedPreviewUrl)} target="_blank" rel="noreferrer" className="btn btn--ghost btn--small">
                      Макет в полном размере
                    </a>
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
              <p>Фото исчезнет из заказа «{item.productNameEn}». Вернуть его будет нельзя — только загрузить заново.</p>
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
    <div className="acc-section acc-coins-page">
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
    <form className="acc-form acc-prof" onSubmit={submit} aria-labelledby="acc-profile-title">
      <section className="acc-prof__hero">
        <div className="acc-form__avatar acc-prof__avatar">
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
        <div className="acc-prof__intro">
          <h2 id="acc-profile-title" className="acc-prof__title">
            Профиль
          </h2>
          <p className="acc-prof__lead">Заполните данные один раз — при оформлении заказа они подставятся сами.</p>
          <div className="acc-prof__progress" aria-label={`Заполнено ${doneCount} из 3`}>
            <span className="acc-prof__bar">
              <span style={{ width: `${(doneCount / 3) * 100}%` }} />
            </span>
            <span className="acc-prof__count">
              {doneCount === 3 ? 'Готово к быстрому заказу' : `Заполнено ${doneCount} из 3`}
            </span>
          </div>
        </div>
      </section>

      <div className="acc-prof__grid">
        <section className="acc-prof__card">
          <header className="acc-prof__head">
            <span className="acc-prof__icon acc-prof__icon--lilac" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </span>
            <h3>Личные данные</h3>
          </header>
          <Input label="Имя и фамилия" maxLength={100} autoComplete="name" value={form.fullName} onChange={set('fullName')} />
          <Textarea label="О себе" hint="Необязательно" maxLength={500} value={form.bio} onChange={set('bio')} />
        </section>

        <section className="acc-prof__card acc-prof__card--accent">
          <header className="acc-prof__head">
            <span className="acc-prof__icon acc-prof__icon--lemon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
                <circle cx="7" cy="18" r="2" />
                <circle cx="17" cy="18" r="2" />
              </svg>
            </span>
            <h3>Для оформления заказа</h3>
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
  );
}

function PasswordForm() {
  const toast = useToast();
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const problems = form.newPassword ? passwordProblems(form.newPassword) : [];

  const submit = async (e) => {
    e.preventDefault();
    if (problems.length) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword(form);
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      toast('Пароль изменён');
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
        lead="Новый пароль начнёт действовать сразу. Старый больше не подойдёт."
        icon={ICONS.lock}
        tone="cherry"
      />
      <div className="acc-prof__grid">
    <form className="acc-card acc-form acc-pw" onSubmit={submit} aria-label="Смена пароля">
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
        <aside className="acc-card acc-prof__card--accent acc-pw-tips">
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
